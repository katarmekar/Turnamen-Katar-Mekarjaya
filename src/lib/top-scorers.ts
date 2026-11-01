export type GoalEventForScorers = {
  type: string;
  playerId: string;
  player: { id: string; fullName: string } | null;
  team: { id: string; name: string } | null;
};

export type TopScorerRow = {
  playerId: string;
  playerName: string;
  teamName: string;
  goals: number;
};

/** Agregasi pencetak gol dari event pertandingan, urut gol terbanyak. */
export function aggregateTopScorers(
  matches: { events?: GoalEventForScorers[] | null }[]
): TopScorerRow[] {
  const map = new Map<
    string,
    { playerName: string; teamName: string; goals: number }
  >();

  for (const match of matches) {
    for (const e of match.events ?? []) {
      if (e.type !== "goal") continue;
      const playerName = e.player?.fullName?.trim() || "Pemain";
      const teamName = e.team?.name?.trim() || "—";
      const prev = map.get(e.playerId);
      if (prev) {
        prev.goals += 1;
      } else {
        map.set(e.playerId, { playerName, teamName, goals: 1 });
      }
    }
  }

  return [...map.entries()]
    .map(([playerId, row]) => ({
      playerId,
      playerName: row.playerName,
      teamName: row.teamName,
      goals: row.goals,
    }))
    .sort(
      (a, b) =>
        b.goals - a.goals ||
        a.playerName.localeCompare(b.playerName, "id") ||
        a.teamName.localeCompare(b.teamName, "id")
    );
}
