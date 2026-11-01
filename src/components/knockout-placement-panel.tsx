"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  reshuffleKnockoutPhase,
  setKnockoutPlacement,
} from "@/app/actions/admin";
import {
  defaultCrossRolePlacement,
  qualifierRoleLabel,
} from "@/lib/league";

export type KnockoutQualifierOption = {
  teamId: string;
  name: string;
  groupIndex: number;
  rank: number;
  label: string;
};

type Tab = "random" | "roles" | "teams";

type RoleSlot = { groupIndex: number; rank: number } | null;

type KnockoutPlacementPanelProps = {
  tournamentId: string;
  bracketSize: number;
  groupCount: number;
  qualifyPerGroup: number;
  qualifiers: KnockoutQualifierOption[];
  /** Urutan slot R1 saat ini: teamId atau null (BYE) */
  currentSlotTeamIds: (string | null)[];
  canEdit: boolean;
};

function roleKey(role: RoleSlot): string {
  if (!role) return "bye";
  return `${role.groupIndex}:${role.rank}`;
}

function parseRoleKey(value: string): RoleSlot {
  if (value === "bye" || value === "") return null;
  const [gi, r] = value.split(":");
  return { groupIndex: Number(gi), rank: Number(r) };
}

function r1MatchLabels(bracketSize: number): string[] {
  const matchCount = bracketSize / 2;
  if (matchCount === 2) return ["Semifinal 1", "Semifinal 2"];
  if (matchCount === 4) {
    return [
      "Perempat final 1",
      "Perempat final 2",
      "Perempat final 3",
      "Perempat final 4",
    ];
  }
  return Array.from({ length: matchCount }, (_, i) => `Babak 1 · Match ${i + 1}`);
}

export function KnockoutPlacementPanel({
  tournamentId,
  bracketSize,
  groupCount,
  qualifyPerGroup,
  qualifiers,
  currentSlotTeamIds,
  canEdit,
}: KnockoutPlacementPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("random");
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const initialRoles = useMemo(() => {
    const byTeam = new Map(qualifiers.map((q) => [q.teamId, q]));
    return Array.from({ length: bracketSize }, (_, i) => {
      const teamId = currentSlotTeamIds[i] ?? null;
      if (!teamId) return null;
      const q = byTeam.get(teamId);
      if (!q) return null;
      return { groupIndex: q.groupIndex, rank: q.rank };
    });
  }, [bracketSize, currentSlotTeamIds, qualifiers]);

  const initialTeams = useMemo(
    () =>
      Array.from({ length: bracketSize }, (_, i) => {
        const id = currentSlotTeamIds[i];
        return id ?? "bye";
      }),
    [bracketSize, currentSlotTeamIds]
  );

  const [roleSlots, setRoleSlots] = useState<RoleSlot[]>(initialRoles);
  const [teamSlots, setTeamSlots] = useState<string[]>(initialTeams);

  const matchLabels = r1MatchLabels(bracketSize);
  const roleOptions = qualifiers.map((q) => ({
    value: `${q.groupIndex}:${q.rank}`,
    label: `${q.label} · ${q.name}`,
  }));

  function setRoleAt(index: number, value: string) {
    setRoleSlots((prev) => {
      const next = [...prev];
      next[index] = parseRoleKey(value);
      return next;
    });
  }

  function setTeamAt(index: number, value: string) {
    setTeamSlots((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function applyCrossPattern() {
    setRoleSlots(
      defaultCrossRolePlacement(groupCount, qualifyPerGroup, bracketSize)
    );
    setTab("roles");
  }

  function runAction(fn: () => Promise<{ error?: string; success?: string }>) {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await fn();
        if (result.error) {
          setMessage({ type: "err", text: result.error });
          return;
        }
        setMessage({
          type: "ok",
          text: result.success ?? "Berhasil disimpan.",
        });
        router.refresh();
      } catch (e) {
        setMessage({
          type: "err",
          text: e instanceof Error ? e.message : "Gagal menyimpan",
        });
      }
    });
  }

  function handleReshuffle() {
    const fd = new FormData();
    fd.set("tournament_id", tournamentId);
    runAction(() => reshuffleKnockoutPhase({}, fd));
  }

  function handleSaveRoles() {
    const fd = new FormData();
    fd.set("tournament_id", tournamentId);
    fd.set("mode", "roles");
    fd.set("placement", JSON.stringify(roleSlots));
    runAction(() => setKnockoutPlacement({}, fd));
  }

  function handleSaveTeams() {
    const fd = new FormData();
    fd.set("tournament_id", tournamentId);
    fd.set("mode", "teams");
    fd.set("placement", JSON.stringify(teamSlots));
    runAction(() => setKnockoutPlacement({}, fd));
  }

  if (!canEdit) {
    return (
      <div className="panel p-4 sm:p-5">
        <h3 className="font-semibold text-white">Atur bagan knockout</h3>
        <p className="mt-2 text-sm text-amber-200">
          Bagan gugur terkunci karena sudah ada skor.
        </p>
      </div>
    );
  }

  return (
    <div className="panel space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">Atur bagan knockout</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Acak ulang atau atur pairing manual selama belum ada skor fase
            gugur. Bagan {bracketSize} · {qualifiers.length} tim lolos.
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost border border-white/15 text-sm"
          disabled={pending}
          onClick={applyCrossPattern}
        >
          Isi pola silang (1A–2B…)
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["random", "Acak"],
            ["roles", "Peran klasemen"],
            ["teams", "Tim"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={
              tab === id
                ? "rounded-md border border-[var(--accent)]/50 bg-[var(--accent)]/15 px-3 py-1.5 text-sm text-white"
                : "rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-[var(--muted)] hover:text-white"
            }
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "random" && (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Acak ulang semua slot babak 1 (termasuk BYE). Hasil grup tidak
            berubah.
          </p>
          <button
            type="button"
            className="btn-primary"
            disabled={pending}
            onClick={handleReshuffle}
          >
            {pending ? "Mengacak…" : "Acak ulang pairing"}
          </button>
        </div>
      )}

      {tab === "roles" && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Pilih peran klasemen untuk tiap sisi pertandingan, misalnya Juara
            Grup A vs Runner-up Grup B.
          </p>
          <div className="space-y-3">
            {matchLabels.map((label, mi) => {
              const a = mi * 2;
              const b = a + 1;
              return (
                <div
                  key={label}
                  className="rounded-lg border border-[var(--border)] bg-black/20 p-3"
                >
                  <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
                    {label}
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                    <select
                      className="input"
                      value={roleKey(roleSlots[a] ?? null)}
                      onChange={(e) => setRoleAt(a, e.target.value)}
                    >
                      <option value="bye">BYE</option>
                      {roleOptions.map((o) => (
                        <option
                          key={o.value}
                          value={o.value}
                          disabled={
                            roleSlots.some(
                              (r, i) =>
                                i !== a && r && roleKey(r) === o.value
                            )
                          }
                        >
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-center text-sm text-[var(--muted)]">
                      vs
                    </span>
                    <select
                      className="input"
                      value={roleKey(roleSlots[b] ?? null)}
                      onChange={(e) => setRoleAt(b, e.target.value)}
                    >
                      <option value="bye">BYE</option>
                      {roleOptions.map((o) => (
                        <option
                          key={o.value}
                          value={o.value}
                          disabled={
                            roleSlots.some(
                              (r, i) =>
                                i !== b && r && roleKey(r) === o.value
                            )
                          }
                        >
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={pending}
            onClick={handleSaveRoles}
          >
            {pending ? "Menyimpan…" : "Simpan pairing (peran)"}
          </button>
        </div>
      )}

      {tab === "teams" && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Isi tiap slot babak 1 dengan nama tim lolos (atau BYE).
          </p>
          <div className="space-y-3">
            {matchLabels.map((label, mi) => {
              const a = mi * 2;
              const b = a + 1;
              return (
                <div
                  key={label}
                  className="rounded-lg border border-[var(--border)] bg-black/20 p-3"
                >
                  <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
                    {label}
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                    <select
                      className="input"
                      value={teamSlots[a] ?? "bye"}
                      onChange={(e) => setTeamAt(a, e.target.value)}
                    >
                      <option value="bye">BYE</option>
                      {qualifiers.map((q) => (
                        <option
                          key={q.teamId}
                          value={q.teamId}
                          disabled={
                            teamSlots.some(
                              (id, i) => i !== a && id === q.teamId
                            )
                          }
                        >
                          {q.name} ({q.label})
                        </option>
                      ))}
                    </select>
                    <span className="text-center text-sm text-[var(--muted)]">
                      vs
                    </span>
                    <select
                      className="input"
                      value={teamSlots[b] ?? "bye"}
                      onChange={(e) => setTeamAt(b, e.target.value)}
                    >
                      <option value="bye">BYE</option>
                      {qualifiers.map((q) => (
                        <option
                          key={q.teamId}
                          value={q.teamId}
                          disabled={
                            teamSlots.some(
                              (id, i) => i !== b && id === q.teamId
                            )
                          }
                        >
                          {q.name} ({q.label})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={pending}
            onClick={handleSaveTeams}
          >
            {pending ? "Menyimpan…" : "Simpan pairing (tim)"}
          </button>
        </div>
      )}

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

      <p className="text-xs text-[var(--muted)]">
        Peran tersedia:{" "}
        {qualifiers
          .map((q) => qualifierRoleLabel(q.groupIndex, q.rank))
          .join(" · ")}
      </p>
    </div>
  );
}
