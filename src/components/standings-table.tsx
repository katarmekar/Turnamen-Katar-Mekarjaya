import type { StandingRow } from "@/lib/standings";

export function StandingsTable({ rows }: { rows: StandingRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Klasemen muncul setelah ada hasil pertandingan.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-[var(--muted)]">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Tim</th>
            <th className="px-3 py-2 font-medium">M</th>
            <th className="px-3 py-2 font-medium">W</th>
            <th className="px-3 py-2 font-medium">D</th>
            <th className="px-3 py-2 font-medium">L</th>
            <th className="px-3 py-2 font-medium">GF</th>
            <th className="px-3 py-2 font-medium">GA</th>
            <th className="px-3 py-2 font-medium">GD</th>
            <th className="px-3 py-2 font-medium">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.teamId} className="border-b border-white/5 last:border-0">
              <td className="px-3 py-2 text-[var(--muted)]">{i + 1}</td>
              <td className="px-3 py-2 font-medium text-white">{r.name}</td>
              <td className="px-3 py-2 text-white">{r.played}</td>
              <td className="px-3 py-2 text-white">{r.won}</td>
              <td className="px-3 py-2 text-white">{r.drawn}</td>
              <td className="px-3 py-2 text-white">{r.lost}</td>
              <td className="px-3 py-2 text-white">{r.gf}</td>
              <td className="px-3 py-2 text-white">{r.ga}</td>
              <td className="px-3 py-2 text-white">{r.gd}</td>
              <td className="px-3 py-2 font-semibold text-sky-300">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
