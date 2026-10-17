"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  lockBracket,
  shuffleBracket,
  startKnockoutPhase,
} from "@/app/actions/admin";
import {
  BracketFilled,
  BracketSkeleton,
  normalizeBracketSize,
  type MatchOutcomeData,
  type SlotData,
} from "@/components/bracket-skeleton";
import SplitFlapText from "@/components/split-flap-text";
import { COMPETITION_FORMAT_LABEL } from "@/lib/format";
import { groupLetter, isLeagueFormat } from "@/lib/league";

const KNOCKOUT_ROUND_BASE = 10;

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
  groupCount?: number | null;
  maxTeamsPerGroup?: number | null;
  qualifyPerGroup?: number | null;
  teams: TeamChip[];
  slots: (SlotData & { groupIndex?: number | null })[];
  matches?: MatchOutcomeData[];
  pendingGroupMatches?: number;
  hasKnockoutPhase?: boolean;
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

/** Bagi nama tim ke slot grup (visual) — merata, hormati maks per grup. */
function distributeNamesToGroups(
  names: string[],
  groupCount: number,
  maxPerGroup: number
): string[][] {
  const shuffled = shuffleList(names);
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  for (const name of shuffled) {
    let best = 0;
    let bestSize = Number.POSITIVE_INFINITY;
    for (let g = 0; g < groupCount; g++) {
      if (groups[g].length < maxPerGroup && groups[g].length < bestSize) {
        best = g;
        bestSize = groups[g].length;
      }
    }
    if (groups[best].length < maxPerGroup) {
      groups[best].push(name);
    }
  }
  return groups;
}

function LeagueGroupBoard({
  groups,
  shuffling,
  padTo,
}: {
  groups: { letter: string; names: string[] }[];
  shuffling: boolean;
  padTo: number;
}) {
  if (groups.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {groups.map((g) => (
        <div
          key={g.letter}
          className={`rounded-lg border px-3 py-3 ${
            shuffling
              ? "border-amber-400/35 bg-amber-500/[0.04]"
              : "border-white/10"
          }`}
        >
          <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
            Grup {g.letter}
          </p>
          <ul className="mt-2 space-y-1">
            {g.names.length === 0 ? (
              <li className="text-sm text-[var(--muted)]">—</li>
            ) : (
              g.names.map((name, i) => (
                <li key={`${g.letter}-${i}`} className="h-5 leading-5">
                  {shuffling ? (
                    <SplitFlapText
                      text={name}
                      padTo={Math.min(padTo, Math.max(name.length, 8))}
                      fontSize="0.875rem"
                      gap={0}
                      flipDuration={0.07}
                      stagger={0.015}
                      flipsPerChar={2}
                      order="random"
                      intro={false}
                      loop={false}
                      tileStyle="minimal"
                      depth={0.2}
                      textColor="#e8eefc"
                      className="league-flap"
                    />
                  ) : (
                    <span className="text-sm font-medium leading-5 text-white">
                      {name}
                    </span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      ))}
    </div>
  );
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
  groupCount,
  maxTeamsPerGroup,
  qualifyPerGroup,
  teams,
  slots,
  matches = [],
  pendingGroupMatches = 0,
  hasKnockoutPhase = false,
}: BracketShufflePanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shuffling, setShuffling] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [r1Labels, setR1Labels] = useState<string[] | undefined>();
  const [liveGroups, setLiveGroups] = useState<string[][] | null>(null);
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runIdRef = useRef(0);
  const stoppedRef = useRef(false);

  const isKnockout = competitionFormat === "knockout";
  const isLeague = isLeagueFormat(competitionFormat);
  const size = normalizeBracketSize(bracketSize ?? maxTeams);
  const confirmed = teams.filter((t) => t.status === "confirmed");
  const waiting = teams.filter((t) => t.status !== "confirmed");
  const hasSlots = slots.length > 0;
  const hasBracket = hasSlots || matchCount > 0;
  const busy = shuffling || pending || committing;
  const canShuffle = confirmed.length >= 2 && !bracketLocked && !busy;
  const showLock = hasBracket && !bracketLocked && !shuffling;
  const canLock = showLock && !busy;
  const canStartKo =
    isLeague &&
    bracketLocked &&
    !hasKnockoutPhase &&
    pendingGroupMatches === 0 &&
    matchCount > 0 &&
    !busy;

  const gCount = Math.max(1, groupCount ?? 4);
  const maxPer = Math.max(2, maxTeamsPerGroup ?? 4);

  const flapPadTo = useMemo(() => {
    const longest = confirmed.reduce(
      (m, t) => Math.max(m, t.name.length),
      8
    );
    return Math.min(22, Math.max(10, longest));
  }, [confirmed]);

  const savedGroupPreview = useMemo(() => {
    if (!isLeague || !hasSlots) return [] as { letter: string; names: string[] }[];
    const map = new Map<number, string[]>();
    for (const s of slots) {
      if (s.groupIndex == null || !s.team?.name) continue;
      const list = map.get(s.groupIndex) ?? [];
      list.push(s.team.name);
      map.set(s.groupIndex, list);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([gi, names]) => ({ letter: groupLetter(gi), names }));
  }, [isLeague, hasSlots, slots]);

  const displayGroups = useMemo(() => {
    if (liveGroups) {
      return liveGroups.map((names, gi) => ({
        letter: groupLetter(gi),
        names,
      }));
    }
    return savedGroupPreview;
  }, [liveGroups, savedGroupPreview]);

  const knockoutSlots = slots.filter(
    (s) => s.groupIndex == null && s.round >= KNOCKOUT_ROUND_BASE
  );
  const expectedKoSize = (() => {
    const n = (groupCount ?? 0) * (qualifyPerGroup ?? 0);
    if (n < 2) return 4;
    let p = 2;
    while (p < n) p *= 2;
    return normalizeBracketSize(p);
  })();
  const koBracketSize = normalizeBracketSize(bracketSize ?? expectedKoSize);

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
    setLiveGroups(null);
  }, [stopTicks]);

  const startKnockoutVisualShuffle = useCallback(() => {
    const pool = buildNamePool(
      confirmed.map((t) => t.name),
      size
    );
    setShuffling(true);
    setR1Labels(shuffleList(pool));
    stopTicks();
    tickRef.current = setInterval(() => {
      setR1Labels(shuffleList(pool));
    }, 420);
  }, [confirmed, size, stopTicks]);

  const startLeagueVisualShuffle = useCallback(() => {
    const names = confirmed.map((t) => t.name);
    setShuffling(true);
    setLiveGroups(distributeNamesToGroups(names, gCount, maxPer));
    stopTicks();
    tickRef.current = setInterval(() => {
      setLiveGroups(distributeNamesToGroups(names, gCount, maxPer));
    }, 420);
  }, [confirmed, gCount, maxPer, stopTicks]);

  async function handleStop() {
    if (!busy && !shuffling) return;

    if (shuffling && !committing) {
      // Stop = hentikan animasi & simpan hasil acak ke server (liga & gugur)
      stoppedRef.current = false;
      const runId = runIdRef.current;
      stopTicks();
      setShuffling(false);
      setCommitting(true);
      const fd = new FormData();
      fd.set("tournament_id", tournamentId);
      try {
        const result = await shuffleBracket({}, fd);
        if (runId !== runIdRef.current) return;
        if (result.error) {
          setMessage({ type: "err", text: result.error });
          setLiveGroups(null);
          setR1Labels(undefined);
          return;
        }
        setMessage({
          type: "ok",
          text:
            result.success ??
            (isLeague ? "Pembagian grup disimpan." : "Bagan disimpan."),
        });
        setLiveGroups(null);
        setR1Labels(undefined);
        startTransition(() => router.refresh());
      } catch (e) {
        if (runId !== runIdRef.current) return;
        setLiveGroups(null);
        setR1Labels(undefined);
        setMessage({
          type: "err",
          text: e instanceof Error ? e.message : "Gagal menyimpan acak",
        });
      } finally {
        setCommitting(false);
      }
      return;
    }
  }

  function handleShuffle() {
    if (!canShuffle) return;
    setMessage(null);
    stoppedRef.current = false;
    runIdRef.current += 1;

    if (isLeague) {
      startLeagueVisualShuffle();
      return;
    }

    startKnockoutVisualShuffle();
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

  async function handleStartKnockout() {
    if (!canStartKo) return;
    setMessage(null);
    const fd = new FormData();
    fd.set("tournament_id", tournamentId);
    startTransition(async () => {
      try {
        const result = await startKnockoutPhase({}, fd);
        if (result.error) {
          setMessage({ type: "err", text: result.error });
          return;
        }
        setMessage({
          type: "ok",
          text: result.success ?? "Fase gugur dibuat.",
        });
        router.refresh();
      } catch (e) {
        setMessage({
          type: "err",
          text: e instanceof Error ? e.message : "Gagal membuat fase gugur",
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
              {isLeague && groupCount
                ? ` · ${groupCount} grup × maks ${maxTeamsPerGroup ?? "—"} · lolos ${qualifyPerGroup ?? "—"}/grup`
                : ""}
              {bracketSize ? ` · bagan ${bracketSize}` : ""}
              {bracketLocked ? " · terkunci" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!bracketLocked && !shuffling && (
              <button
                type="button"
                className="btn-ghost border border-white/15"
                disabled={!canShuffle}
                onClick={handleShuffle}
              >
                {matchCount > 0 || hasSlots
                  ? "Acak ulang"
                  : isKnockout
                    ? "Acak tim ke bagan"
                    : "Acak ke grup"}
              </button>
            )}
            {(shuffling || committing) && (
              <button
                type="button"
                className="btn-primary"
                disabled={committing}
                onClick={handleStop}
              >
                {committing ? "Menyimpan..." : "Stop & simpan"}
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
            {canStartKo && (
              <button
                type="button"
                className="btn-primary"
                onClick={handleStartKnockout}
              >
                {pending ? "Membuat..." : "Buat fase gugur"}
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
          {shuffling
            ? isKnockout
              ? "Nama tim sedang berputar di slot bagan — tekan Stop & simpan untuk menetapkan."
              : "Nama tim sedang berpindah antar grup — tekan Stop & simpan untuk menetapkan pembagian."
            : isKnockout
              ? "Acak tim ke bagan dengan efek putar nama, lalu Stop & simpan. Setelah itu Tetapkan bagan."
              : "Acak ke grup: nama berputar antar grup sampai Stop. Lalu Tetapkan bagan."}{" "}
          {bracketLocked
            ? hasKnockoutPhase
              ? "Fase grup selesai / fase gugur sudah dibuat."
              : pendingGroupMatches > 0
                ? `Selesaikan ${pendingGroupMatches} pertandingan grup; fase gugur dibuat otomatis (atau tombol di atas).`
                : isLeague
                  ? "Semua match grup selesai — buat fase gugur jika belum otomatis."
                  : null
            : !shuffling && hasBracket
              ? "Periksa hasil acak, lalu tetapkan jika sudah final."
              : !shuffling && confirmed.length < 2
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
                Live shuffle
              </p>
              <button
                type="button"
                className="rounded-full border border-amber-400/50 bg-black/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-200 backdrop-blur"
                disabled={committing}
                onClick={handleStop}
              >
                {committing ? "Menyimpan…" : "Stop & simpan"}
              </button>
            </div>
          )}
          {hasSlots && !shuffling ? (
            <BracketFilled
              slots={slots}
              bracketSize={bracketSize ?? maxTeams}
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
        <div className="space-y-5">
          <div className="panel space-y-4 p-5 text-sm text-[var(--muted)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                {shuffling
                  ? "Mengacak pembagian grup…"
                  : "Sistem liga — fase grup, lalu bagan knockout."}
              </p>
              {shuffling && (
                <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-amber-300">
                  Live shuffle
                </span>
              )}
            </div>
            {(displayGroups.length > 0 || shuffling) && (
              <LeagueGroupBoard
                groups={
                  displayGroups.length > 0
                    ? displayGroups
                    : Array.from({ length: gCount }, (_, i) => ({
                        letter: groupLetter(i),
                        names: [],
                      }))
                }
                shuffling={shuffling}
                padTo={flapPadTo}
              />
            )}
          </div>

          <div className="space-y-3">
            <div className="panel p-4">
              <h3 className="font-semibold text-white">
                Bagan knockout
                {koBracketSize <= 4 ? " (semifinal → final)" : ""}
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {hasKnockoutPhase
                  ? `Tim lolos dari grup · bagan ${koBracketSize}`
                  : `Kerangka bagan ${koBracketSize} — terisi otomatis setelah fase grup selesai.`}
              </p>
            </div>
            {hasKnockoutPhase && knockoutSlots.length > 0 ? (
              <BracketFilled
                slots={knockoutSlots}
                bracketSize={koBracketSize}
                matches={matches}
              />
            ) : (
              <BracketSkeleton maxTeams={koBracketSize} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
