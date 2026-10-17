"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lockBracket, shuffleBracket } from "@/app/actions/admin";
import {
  BracketFilled,
  BracketSkeleton,
  normalizeBracketSize,
  type MatchOutcomeData,
  type SlotData,
} from "@/components/bracket-skeleton";
import { COMPETITION_FORMAT_LABEL } from "@/lib/format";

type TeamChip = {
  id: string;
  name: string;
  status: string;
};

type BracketShufflePanelProps = {
  tournamentId: string;
  tournamentName: string;
  status: string;
  competitionFormat: string;
  maxTeams: number;
  bracketSize: number | null;
  bracketLocked: boolean;
  matchCount: number;
  teams: TeamChip[];
  slots: SlotData[];
  matches?: MatchOutcomeData[];
};

function shuffleList<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildNamePool(names: string[], size: number) {
  const byeCount = Math.max(0, size - names.length);
  return [...names, ...Array.from({ length: byeCount }, () => "BYE")];
}

export function BracketShufflePanel({
  tournamentId,
  tournamentName,
  status,
  competitionFormat,
  maxTeams,
  bracketSize,
  bracketLocked,
  matchCount,
  teams,
  slots,
  matches = [],
}: BracketShufflePanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shuffling, setShuffling] = useState(false);
  const [r1Labels, setR1Labels] = useState<string[] | undefined>();
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runIdRef = useRef(0);
  const stoppedRef = useRef(false);

  const isKnockout = competitionFormat === "knockout";
  const size = normalizeBracketSize(bracketSize ?? maxTeams);
  const confirmed = teams.filter((t) => t.status === "confirmed");
  const waiting = teams.filter((t) => t.status !== "confirmed");
  const hasSlots = slots.length > 0;
  const hasBracket = hasSlots || matchCount > 0;
  const busy = shuffling || pending;
  const canShuffle = confirmed.length >= 2 && !bracketLocked && !busy;
  const showLock = hasBracket && !bracketLocked;
  const canLock = showLock && !busy;

  const stopTicks = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  useEffect(() => () => stopTicks(), [stopTicks]);

  const resetVisual = useCallback(() => {
    stopTicks();
    setShuffling(false);
    setR1Labels(undefined);
  }, [stopTicks]);

  const handleStop = useCallback(() => {
    if (!busy) return;
    stoppedRef.current = true;
    runIdRef.current += 1;
    resetVisual();
    setMessage({
      type: "err",
      text: "Acak dihentikan. Jika server sudah selesai, refresh halaman untuk melihat hasil.",
    });
  }, [busy, resetVisual]);

  const startVisualShuffle = useCallback(() => {
    const pool = buildNamePool(
      confirmed.map((t) => t.name),
      size
    );
    setShuffling(true);
    setR1Labels(shuffleList(pool));
    stopTicks();
    tickRef.current = setInterval(() => {
      setR1Labels(shuffleList(pool));
    }, 70);
  }, [confirmed, size, stopTicks]);

  async function handleShuffle() {
    if (!canShuffle) return;
    setMessage(null);
    stoppedRef.current = false;
    const runId = ++runIdRef.current;

    const started = Date.now();
    if (isKnockout) startVisualShuffle();

    const fd = new FormData();
    fd.set("tournament_id", tournamentId);

    try {
      const result = await shuffleBracket({}, fd);
      if (stoppedRef.current || runId !== runIdRef.current) return;

      const elapsed = Date.now() - started;
      const minMs = isKnockout ? 2200 : 400;
      if (elapsed < minMs) {
        await new Promise((r) => setTimeout(r, minMs - elapsed));
      }
      if (stoppedRef.current || runId !== runIdRef.current) return;

      stopTicks();

      if (result.error) {
        resetVisual();
        setMessage({ type: "err", text: result.error });
        return;
      }

      setMessage({
        type: "ok",
        text: result.success ?? "Bagan berhasil dibuat.",
      });
      setTimeout(() => {
        if (stoppedRef.current || runId !== runIdRef.current) return;
        resetVisual();
        startTransition(() => router.refresh());
      }, 280);
    } catch (e) {
      if (stoppedRef.current || runId !== runIdRef.current) return;
      resetVisual();
      setMessage({
        type: "err",
        text: e instanceof Error ? e.message : "Gagal mengacak",
      });
    }
  }

  async function handleLock() {
    if (!canLock) return;
    setMessage(null);
    const fd = new FormData();
    fd.set("tournament_id", tournamentId);

    startTransition(async () => {
      try {
        const result = await lockBracket({}, fd);
        if (result.error) {
          setMessage({ type: "err", text: result.error });
          return;
        }
        setMessage({
          type: "ok",
          text: result.success ?? "Bagan ditetapkan.",
        });
        router.refresh();
      } catch (e) {
        setMessage({
          type: "err",
          text: e instanceof Error ? e.message : "Gagal menetapkan bagan",
        });
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="panel space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-medium text-white">{tournamentName}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Status {status} ·{" "}
              {COMPETITION_FORMAT_LABEL[competitionFormat] ?? competitionFormat}{" "}
              · siap acak {confirmed.length} / max {maxTeams}
              {bracketSize ? ` · bagan ${bracketSize}` : ""}
              {bracketLocked ? " · terkunci" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!bracketLocked && (
              <button
                type="button"
                className="btn-ghost border border-white/15"
                disabled={!canShuffle}
                onClick={handleShuffle}
              >
                {busy && shuffling
                  ? "Mengacak..."
                  : matchCount > 0 || hasSlots
                    ? "Acak ulang"
                    : isKnockout
                      ? "Acak tim ke bagan"
                      : "Acak jadwal"}
              </button>
            )}
            {busy && (
              <button
                type="button"
                className="btn-ghost border border-red-400/40 text-red-300"
                onClick={handleStop}
              >
                Stop
              </button>
            )}
            {showLock && (
              <button
                type="button"
                className="btn-primary"
                disabled={!canLock}
                onClick={handleLock}
              >
                {pending && !shuffling ? "Menetapkan..." : "Tetapkan bagan"}
              </button>
            )}
            {bracketLocked && (
              <span className="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
                Bagan terkunci
              </span>
            )}
          </div>
        </div>

        <p className="text-sm text-[var(--muted)]">
          {isKnockout
            ? "Tim confirmed masuk ke slot bagan. Acak dulu, lalu tekan Tetapkan bagan agar tidak bisa diacak ulang."
            : "Acak jadwal, lalu Tetapkan bagan agar tidak bisa diacak ulang."}{" "}
          {bracketLocked
            ? "Bagan sudah ditetapkan dan terkunci sampai pertandingan selesai."
            : hasBracket
              ? "Periksa hasil acak, lalu tetapkan jika sudah final."
              : confirmed.length < 2
                ? "Minimal 2 tim confirmed."
                : null}
        </p>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
            Tim di bagan ({confirmed.length} siap · {waiting.length} menunggu)
          </p>
          <div className="flex flex-wrap gap-2">
            {confirmed.map((t) => (
              <span key={t.id} className="bracket-team-chip is-ready">
                {t.name}
              </span>
            ))}
            {waiting.map((t) => (
              <span key={t.id} className="bracket-team-chip is-wait" title={t.status}>
                {t.name}
              </span>
            ))}
            {teams.length === 0 && (
              <span className="text-sm text-[var(--muted)]">
                Belum ada tim mendaftar.
              </span>
            )}
          </div>
        </div>

        {message && (
          <p
            className={
              message.type === "ok"
                ? "rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"
                : "rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            }
          >
            {message.text}
          </p>
        )}
      </div>

      {isKnockout ? (
        <div className="relative">
          {shuffling && (
            <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2">
              <p className="rounded-full border border-amber-400/40 bg-black/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-amber-300 backdrop-blur">
                Mengacak slot…
              </p>
              <button
                type="button"
                className="rounded-full border border-red-400/50 bg-black/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-red-300 backdrop-blur"
                onClick={handleStop}
              >
                Stop
              </button>
            </div>
          )}
          {hasSlots && !shuffling ? (
            <BracketFilled
              slots={slots}
              bracketSize={bracketSize ?? maxTeams}
              r1Labels={r1Labels}
              shuffling={shuffling}
              matches={matches}
            />
          ) : (
            <BracketSkeleton
              maxTeams={maxTeams}
              r1Labels={r1Labels}
              shuffling={shuffling}
            />
          )}
        </div>
      ) : (
        <div className="panel p-5 text-sm text-[var(--muted)]">
          Format sistem liga — hasil acak berupa daftar pertandingan di menu
          Jadwal & skor / bagan publik (klasemen).
        </div>
      )}
    </div>
  );
}
