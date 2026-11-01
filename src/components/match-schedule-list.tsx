"use client";

import { useMemo, useState } from "react";

export type ScheduleMatchItem = {
  id: string;
  scheduledAt: Date | string | null;
  notes: string | null;
  resultType: string | null;
  scoreA: number | null;
  scoreB: number | null;
  teamAName: string;
  teamBName: string;
  winnerName: string | null;
};

/** Default = akan berlangsung; per hari / per tim = filter eksklusif. */
type FilterMode = "upcoming" | "day" | "team";

function toDate(value: Date | string | null): Date | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayLabel(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function formatTime(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function matchLine(m: ScheduleMatchItem): string {
  const parts = [
    m.notes,
    m.resultType
      ? m.scoreA != null && m.scoreB != null
        ? `${m.scoreA}-${m.scoreB}`
        : m.resultType
      : "Belum main",
    m.winnerName
      ? m.winnerName
      : m.resultType === "score" && m.scoreA === m.scoreB
        ? "Seri"
        : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function sortBySchedule(a: ScheduleMatchItem, b: ScheduleMatchItem) {
  const ax = toDate(a.scheduledAt)?.getTime() ?? Number.POSITIVE_INFINITY;
  const ay = toDate(b.scheduledAt)?.getTime() ?? Number.POSITIVE_INFINITY;
  return ax - ay;
}

function isUpcoming(m: ScheduleMatchItem, now: number) {
  if (m.resultType) return false;
  const at = toDate(m.scheduledAt);
  if (!at) return true;
  return at.getTime() >= now;
}

function MatchRow({ m }: { m: ScheduleMatchItem }) {
  const when = toDate(m.scheduledAt);
  const detail = matchLine(m);
  return (
    <li className="rounded-lg border border-[var(--border)] px-3 py-2 text-[var(--muted)]">
      <span className="text-white">
        {m.teamAName} vs {m.teamBName}
      </span>
      {when ? (
        <span className="text-[var(--muted)]"> · {formatTime(when)}</span>
      ) : null}
      {detail ? ` · ${detail}` : ""}
    </li>
  );
}

type MatchScheduleListProps = {
  matches: ScheduleMatchItem[];
};

export function MatchScheduleList({ matches }: MatchScheduleListProps) {
  const [filterMode, setFilterMode] = useState<FilterMode>("upcoming");
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [selectedTeam, setSelectedTeam] = useState<string>("");

  const dayOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of matches) {
      const at = toDate(m.scheduledAt);
      if (!at) continue;
      const key = dayKey(at);
      if (!map.has(key)) map.set(key, formatDayLabel(at));
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, label]) => ({ value, label }));
  }, [matches]);

  const teamOptions = useMemo(() => {
    const names = new Set<string>();
    for (const m of matches) {
      for (const name of [m.teamAName, m.teamBName]) {
        if (!name || name === "—" || name === "BYE" || name === "TBD") continue;
        names.add(name);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b, "id"));
  }, [matches]);

  const activeDay = selectedDay || dayOptions[0]?.value || "";
  const activeTeam = selectedTeam || teamOptions[0] || "";

  const filtered = useMemo(() => {
    const now = Date.now();
    if (filterMode === "upcoming") {
      return matches.filter((m) => isUpcoming(m, now)).sort(sortBySchedule);
    }
    if (filterMode === "day") {
      if (!activeDay) return [];
      return matches
        .filter((m) => {
          const at = toDate(m.scheduledAt);
          return at ? dayKey(at) === activeDay : false;
        })
        .sort(sortBySchedule);
    }
    if (!activeTeam) return [];
    return matches
      .filter(
        (m) => m.teamAName === activeTeam || m.teamBName === activeTeam
      )
      .sort(sortBySchedule);
  }, [matches, filterMode, activeDay, activeTeam]);

  function selectMode(mode: FilterMode) {
    setFilterMode(mode);
    if (mode === "day" && !selectedDay && dayOptions[0]) {
      setSelectedDay(dayOptions[0].value);
    }
    if (mode === "team" && !selectedTeam && teamOptions[0]) {
      setSelectedTeam(teamOptions[0]);
    }
  }

  const modeHint =
    filterMode === "upcoming"
      ? "Hanya pertandingan yang belum selesai / akan berlangsung."
      : filterMode === "day"
        ? "Filter per hari aktif. Filter per tim nonaktif."
        : "Filter per tim aktif. Filter per hari nonaktif.";

  return (
    <div className="panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">Daftar pertandingan</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">{modeHint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["upcoming", "Akan berlangsung"],
              ["day", "Per hari"],
              ["team", "Per tim"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={
                filterMode === mode
                  ? "rounded-md border border-[var(--accent)]/50 bg-[var(--accent)]/15 px-3 py-1.5 text-sm text-white"
                  : "rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-[var(--muted)] hover:text-white"
              }
              aria-pressed={filterMode === mode}
              onClick={() => selectMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filterMode === "day" && (
        <label className="mt-4 flex max-w-md flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Pilih hari</span>
          <select
            className="input"
            value={activeDay}
            disabled={dayOptions.length === 0}
            onChange={(e) => setSelectedDay(e.target.value)}
          >
            {dayOptions.length === 0 ? (
              <option value="">Tidak ada jadwal bertanggal</option>
            ) : (
              dayOptions.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))
            )}
          </select>
        </label>
      )}

      {filterMode === "team" && (
        <label className="mt-4 flex max-w-md flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Pilih tim</span>
          <select
            className="input"
            value={activeTeam}
            disabled={teamOptions.length === 0}
            onChange={(e) => setSelectedTeam(e.target.value)}
          >
            {teamOptions.length === 0 ? (
              <option value="">Belum ada tim</option>
            ) : (
              teamOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))
            )}
          </select>
        </label>
      )}

      {matches.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Belum ada pertandingan.
        </p>
      ) : filtered.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          {filterMode === "upcoming"
            ? "Tidak ada pertandingan yang akan berlangsung."
            : filterMode === "day"
              ? "Tidak ada pertandingan pada tanggal yang dipilih."
              : "Tidak ada pertandingan untuk tim ini."}
        </p>
      ) : (
        <ul className="mt-4 space-y-2 text-sm">
          {filtered.map((m) => (
            <MatchRow key={m.id} m={m} />
          ))}
        </ul>
      )}
    </div>
  );
}
