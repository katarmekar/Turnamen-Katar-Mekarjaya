import type { StandingRow } from "@/lib/standings";
import { computeStandings } from "@/lib/standings";

/** Default poin sistem liga (bisa diubah per turnamen di Edit turnamen). */
export const LEAGUE_POINTS = { win: 2, draw: 1, loss: 0 } as const;

export type LeaguePointsConfig = {
  pointsWin?: number;
  pointsDraw?: number;
  pointsLoss?: number;
};

export function isLeagueFormat(format: string | null | undefined): boolean {
  return (
    format === "single_round_robin" || format === "double_round_robin"
  );
}

export function groupLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

export function distributeTeamsIntoGroups(
  teamIds: string[],
  groupCount: number,
  maxTeamsPerGroup: number
): string[][] {
  if (groupCount < 1) {
    throw new Error("Jumlah grup minimal 1.");
  }
  if (maxTeamsPerGroup < 2) {
    throw new Error("Maksimal tim per grup minimal 2.");
  }
  if (teamIds.length < 2) {
    throw new Error("Minimal 2 tim confirmed untuk membuat jadwal.");
  }
  if (teamIds.length > groupCount * maxTeamsPerGroup) {
    throw new Error(
      `Tim confirmed (${teamIds.length}) melebihi kapasitas grup (${groupCount}×${maxTeamsPerGroup}).`
    );
  }

  const shuffled = [...teamIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  for (const id of shuffled) {
    let best = -1;
    let bestSize = Number.POSITIVE_INFINITY;
    for (let g = 0; g < groupCount; g++) {
      if (
        groups[g].length < maxTeamsPerGroup &&
        groups[g].length < bestSize
      ) {
        best = g;
        bestSize = groups[g].length;
      }
    }
    if (best < 0) {
      throw new Error("Tidak ada slot grup tersisa untuk semua tim.");
    }
    groups[best].push(id);
  }

  return groups;
}

export type LeagueMatchForMatrix = {
  groupIndex: number | null;
  resultType: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerTeamId: string | null;
  slotA: {
    teamId: string | null;
    team: { id: string; name: string } | null;
  };
  slotB: {
    teamId: string | null;
    team: { id: string; name: string } | null;
  };
};

export type MatrixCell = {
  label: string;
  kind: "empty" | "self" | "pending" | "score" | "result";
};

export type GroupMatrix = {
  groupIndex: number;
  letter: string;
  teams: { id: string; name: string }[];
  cells: MatrixCell[][];
  standings: StandingRow[];
};

function cellForPair(
  rowId: string,
  colId: string,
  matches: LeagueMatchForMatrix[]
): MatrixCell {
  if (rowId === colId) {
    return { label: "—", kind: "self" };
  }

  const m = matches.find((x) => {
    const a = x.slotA.teamId;
    const b = x.slotB.teamId;
    return (
      (a === rowId && b === colId) || (a === colId && b === rowId)
    );
  });

  if (!m) return { label: "", kind: "empty" };
  if (!m.resultType) return { label: "…", kind: "pending" };

  const aIsRow = m.slotA.teamId === rowId;
  const sa = m.scoreA;
  const sb = m.scoreB;

  if (sa != null && sb != null) {
    return {
      label: aIsRow ? `${sa}–${sb}` : `${sb}–${sa}`,
      kind: "score",
    };
  }

  if (m.winnerTeamId === rowId) return { label: "M", kind: "result" };
  if (m.winnerTeamId && m.winnerTeamId !== rowId) {
    return { label: "K", kind: "result" };
  }
  return { label: "S", kind: "result" };
}

/** Bangun matriks hasil + klasemen per grup dari pertandingan fase grup. */
export function buildGroupMatrices(
  matches: LeagueMatchForMatrix[],
  slots: {
    groupIndex: number | null;
    teamId: string | null;
    team: { id: string; name: string } | null;
  }[],
  points: LeaguePointsConfig = {}
): GroupMatrix[] {
  const pointsWin = points.pointsWin ?? LEAGUE_POINTS.win;
  const pointsDraw = points.pointsDraw ?? LEAGUE_POINTS.draw;
  const pointsLoss = points.pointsLoss ?? LEAGUE_POINTS.loss;
  const groupMatches = matches.filter((m) => m.groupIndex != null);
  const groupIndexes = [
    ...new Set(
      [
        ...groupMatches.map((m) => m.groupIndex!),
        ...slots
          .filter((s) => s.groupIndex != null)
          .map((s) => s.groupIndex!),
      ].sort((a, b) => a - b)
    ),
  ];

  return groupIndexes.map((groupIndex) => {
    const gMatches = groupMatches.filter((m) => m.groupIndex === groupIndex);
    const teamMap = new Map<string, string>();

    for (const s of slots) {
      if (s.groupIndex === groupIndex && s.teamId && s.team) {
        teamMap.set(s.teamId, s.team.name);
      }
    }
    for (const m of gMatches) {
      if (m.slotA.teamId && m.slotA.team) {
        teamMap.set(m.slotA.teamId, m.slotA.team.name);
      }
      if (m.slotB.teamId && m.slotB.team) {
        teamMap.set(m.slotB.teamId, m.slotB.team.name);
      }
    }

    const teams = [...teamMap.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const cells = teams.map((row) =>
      teams.map((col) => cellForPair(row.id, col.id, gMatches))
    );

    const standings = computeStandings(gMatches, {
      pointsWin,
      pointsDraw,
      pointsLoss,
    });

    // Pastikan tim tanpa hasil tetap muncul di klasemen (0 poin)
    for (const t of teams) {
      if (!standings.some((r) => r.teamId === t.id)) {
        standings.push({
          teamId: t.id,
          name: t.name,
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
    }
    standings.sort(
      (x, y) =>
        y.points - x.points ||
        y.gd - x.gd ||
        y.gf - x.gf ||
        x.name.localeCompare(y.name)
    );

    return {
      groupIndex,
      letter: groupLetter(groupIndex),
      teams,
      cells,
      standings,
    };
  });
}

export type QualifierInfo = {
  teamId: string;
  name: string;
  groupIndex: number;
  rank: number;
  label: string;
};

/** Label peran klasemen, contoh: Juara Grup A / Runner-up Grup B. */
export function qualifierRoleLabel(groupIndex: number, rank: number): string {
  const letter = groupLetter(groupIndex);
  if (rank === 1) return `Juara Grup ${letter}`;
  if (rank === 2) return `Runner-up Grup ${letter}`;
  return `Peringkat ${rank} Grup ${letter}`;
}

export function pickQualifiers(
  matrices: GroupMatrix[],
  qualifyPerGroup: number
): QualifierInfo[] {
  const out: QualifierInfo[] = [];

  for (const g of matrices) {
    const top = g.standings.slice(0, Math.max(0, qualifyPerGroup));
    top.forEach((row, i) => {
      const rank = i + 1;
      out.push({
        teamId: row.teamId,
        name: row.name,
        groupIndex: g.groupIndex,
        rank,
        label: qualifierRoleLabel(g.groupIndex, rank),
      });
    });
  }

  return out;
}

/**
 * Pola silang default untuk slot R1 (ukuran genap).
 * 4 grup × 2 lolos: 1A–2B, 1C–2D, 1B–2A, 1D–2C.
 * Selain itu: isi berurutan Juara→Runner per grup, sisa = null (BYE).
 */
export function defaultCrossRolePlacement(
  groupCount: number,
  qualifyPerGroup: number,
  bracketSize: number
): ({ groupIndex: number; rank: number } | null)[] {
  const slots: ({ groupIndex: number; rank: number } | null)[] = Array.from(
    { length: bracketSize },
    () => null
  );

  if (groupCount === 4 && qualifyPerGroup === 2 && bracketSize >= 8) {
    const pattern: [number, number][] = [
      [0, 1],
      [1, 2],
      [2, 1],
      [3, 2],
      [1, 1],
      [0, 2],
      [3, 1],
      [2, 2],
    ];
    pattern.forEach(([gi, rank], i) => {
      slots[i] = { groupIndex: gi, rank };
    });
    return slots;
  }

  let i = 0;
  for (let rank = 1; rank <= qualifyPerGroup && i < bracketSize; rank++) {
    for (let gi = 0; gi < groupCount && i < bracketSize; gi++) {
      slots[i++] = { groupIndex: gi, rank };
    }
  }
  return slots;
}
