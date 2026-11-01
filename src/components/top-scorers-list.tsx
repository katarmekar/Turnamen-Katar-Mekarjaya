import type { TopScorerRow } from "@/lib/top-scorers";

type TopScorersListProps = {
  scorers: TopScorerRow[];
  title?: string;
  hint?: string;
};

/** Rekap pencetak gol: ~3 baris terlihat, sisanya scroll. */
export function TopScorersList({
  scorers,
  title = "Top skor sementara",
  hint = "Rekap keseluruhan pencetak gol turnamen. Tiga teratas terlihat; gulir untuk peringkat berikutnya.",
}: TopScorersListProps) {
  return (
    <div className="panel p-4">
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm text-[var(--muted)]">{hint}</p>

      {scorers.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          Belum ada gol tercatat dari rekap pertandingan.
        </p>
      ) : (
        <ul className="mt-3 max-h-[8.25rem] space-y-1.5 overflow-y-auto overscroll-contain pr-1">
          {scorers.map((s, index) => {
            const rank = index + 1;
            const isTop3 = rank <= 3;
            return (
              <li
                key={s.playerId}
                className={`flex h-10 shrink-0 items-center gap-3 rounded-md px-2.5 text-sm ${
                  isTop3
                    ? "border border-[var(--accent)]/25 bg-[var(--accent)]/10"
                    : "border border-transparent bg-black/20"
                }`}
              >
                <span
                  className={`w-6 shrink-0 text-center font-medium ${
                    isTop3 ? "text-[var(--accent)]" : "text-[var(--muted)]"
                  }`}
                >
                  {rank}
                </span>
                <span className="min-w-0 flex-1 truncate text-white">
                  {s.playerName}
                  <span className="text-[var(--muted)]"> · {s.teamName}</span>
                </span>
                <span className="shrink-0 font-medium text-white">
                  {s.goals}{" "}
                  <span className="text-[var(--muted)]">
                    gol
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
