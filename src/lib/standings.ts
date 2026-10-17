type MatchForStandings = {
  resultType: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerTeamId: string | null;
  slotA: { teamId: string | null; team: { id: string; name: string } | null };
  slotB: { teamId: string | null; team: { id: string; name: string } | null };
};

export type StandingRow = {
  teamId: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

export function computeStandings(matches: MatchForStandings[]): StandingRow[] {
  const map = new Map<string, StandingRow>();

  const ensure = (id: string, name: string) => {
    if (!map.has(id)) {
      map.set(id, {
        teamId: id,
        name,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        points: 0,
      });
    }
    return map.get(id)!;
  };

  for (const m of matches) {
    if (!m.resultType) continue;
    const aId = m.slotA.teamId;
    const bId = m.slotB.teamId;
    if (!aId || !bId) continue;

    const a = ensure(aId, m.slotA.team?.name ?? "—");
    const b = ensure(bId, m.slotB.team?.name ?? "—");
    const sa = m.scoreA ?? 0;
    const sb = m.scoreB ?? 0;

    a.played += 1;
    b.played += 1;
    a.gf += sa;
    a.ga += sb;
    b.gf += sb;
    b.ga += sa;

    if (m.winnerTeamId === aId) {
      a.won += 1;
      b.lost += 1;
      a.points += 3;
    } else if (m.winnerTeamId === bId) {
      b.won += 1;
      a.lost += 1;
      b.points += 3;
    } else {
      a.drawn += 1;
      b.drawn += 1;
      a.points += 1;
      b.points += 1;
    }
  }

  for (const row of map.values()) {
    row.gd = row.gf - row.ga;
  }

  return [...map.values()].sort(
    (x, y) =>
      y.points - x.points ||
      y.gd - x.gd ||
      y.gf - x.gf ||
      x.name.localeCompare(y.name)
  );
}
