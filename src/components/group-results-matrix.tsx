import type { GroupMatrix } from "@/lib/league";
import { StandingsTable } from "@/components/standings-table";

export function GroupResultsMatrix({ groups }: { groups: GroupMatrix[] }) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Matriks grup muncul setelah jadwal fase grup dibuat.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <div key={g.groupIndex} className="space-y-4">
          <h4 className="font-semibold text-white">Grup {g.letter}</h4>

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
                        className="border border-white/10 bg-white/[0.04] px-2 py-2 font-medium text-white"
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
                      <th className="border border-white/10 bg-white/[0.04] px-2 py-2 text-left font-medium text-white">
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
                Skor dari sudut pandang tim di baris kiri. Poin: menang 2 · seri
                1 · kalah 0.
              </p>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-[var(--muted)]">
              Klasemen Grup {g.letter}
            </p>
            <StandingsTable rows={g.standings} />
          </div>
        </div>
      ))}
    </div>
  );
}
