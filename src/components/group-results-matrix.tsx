"use client";

import { useEffect, useMemo, useState } from "react";
import type { GroupMatrix } from "@/lib/league";
import { LEAGUE_POINTS } from "@/lib/league";
import { StandingsTable } from "@/components/standings-table";

export function GroupResultsMatrix({
  groups,
  pointsWin = LEAGUE_POINTS.win,
  pointsDraw = LEAGUE_POINTS.draw,
  pointsLoss = LEAGUE_POINTS.loss,
  focusTeamId,
}: {
  groups: GroupMatrix[];
  pointsWin?: number;
  pointsDraw?: number;
  pointsLoss?: number;
  /** Tim manajer — grup ini dipilih default di dropdown. */
  focusTeamId?: string | null;
}) {
  const defaultIndex = useMemo(() => {
    if (groups.length === 0) return 0;
    if (focusTeamId) {
      const mine = groups.find((g) =>
        g.teams.some((t) => t.id === focusTeamId)
      );
      if (mine) return mine.groupIndex;
    }
    return groups[0].groupIndex;
  }, [groups, focusTeamId]);

  const [selectedIndex, setSelectedIndex] = useState(defaultIndex);

  useEffect(() => {
    setSelectedIndex(defaultIndex);
  }, [defaultIndex]);

  const activeIndex = groups.some((g) => g.groupIndex === selectedIndex)
    ? selectedIndex
    : defaultIndex;

  if (groups.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Matriks grup muncul setelah jadwal fase grup dibuat.
      </p>
    );
  }

  const g = groups.find((x) => x.groupIndex === activeIndex) ?? groups[0];
  const isOwnGroup =
    !!focusTeamId && g.teams.some((t) => t.id === focusTeamId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm sm:max-w-xs">
          <span className="text-[var(--muted)]">Hasil &amp; klasemen</span>
          <select
            className="input font-semibold text-white"
            value={activeIndex}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
            aria-label="Pilih grup"
          >
            {groups.map((opt) => {
              const own =
                !!focusTeamId &&
                opt.teams.some((t) => t.id === focusTeamId);
              return (
                <option key={opt.groupIndex} value={opt.groupIndex}>
                  Grup {opt.letter}
                  {own ? " · grup Anda" : ""}
                  {` (${opt.teams.length} tim)`}
                </option>
              );
            })}
          </select>
        </label>
        {isOwnGroup && (
          <p className="text-xs text-[var(--accent)]">Grup tim Anda</p>
        )}
      </div>

      <div className="space-y-4">
        {g.teams.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Belum ada tim.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[20rem] border-collapse text-center text-sm">
              <thead>
                <tr>
                  <th className="border border-white/10 bg-white/[0.04] px-2 py-2 text-left text-[var(--muted)]">
                    Tim
                  </th>
                  {g.teams.map((t) => (
                    <th
                      key={t.id}
                      className={`border border-white/10 px-2 py-2 font-medium ${
                        t.id === focusTeamId
                          ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                          : "bg-white/[0.04] text-white"
                      }`}
                      title={t.name}
                    >
                      <span className="inline-block max-w-[4.5rem] truncate align-bottom">
                        {t.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {g.teams.map((row, ri) => (
                  <tr key={row.id}>
                    <th
                      className={`border border-white/10 px-2 py-2 text-left font-medium ${
                        row.id === focusTeamId
                          ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                          : "bg-white/[0.04] text-white"
                      }`}
                    >
                      {row.name}
                    </th>
                    {g.cells[ri].map((cell, ci) => (
                      <td
                        key={`${row.id}-${g.teams[ci].id}`}
                        className={`border border-white/10 px-2 py-2 ${
                          cell.kind === "self"
                            ? "bg-white/[0.06] text-[var(--muted)]"
                            : cell.kind === "pending"
                              ? "text-[var(--muted)]"
                              : cell.kind === "score" || cell.kind === "result"
                                ? "font-medium text-sky-200"
                                : "text-[var(--muted)]"
                        }`}
                      >
                        {cell.label || "·"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="border border-white/10 px-2 py-2 text-left text-[11px] text-[var(--muted)]">
                    Lawan →
                  </td>
                  {g.teams.map((t) => (
                    <td
                      key={`foot-${t.id}`}
                      className="border border-white/10 px-1 py-2 text-[11px] text-[var(--muted)]"
                      title={t.name}
                    >
                      <span className="inline-block max-w-[4.5rem] truncate">
                        {t.name}
                      </span>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Skor dari sudut pandang tim di baris kiri. Poin: menang {pointsWin}{" "}
              · seri {pointsDraw} · kalah {pointsLoss}.
            </p>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-[var(--muted)]">
            Klasemen Grup {g.letter}
          </p>
          <StandingsTable rows={g.standings} highlightTeamId={focusTeamId} />
        </div>
      </div>
    </div>
  );
}
