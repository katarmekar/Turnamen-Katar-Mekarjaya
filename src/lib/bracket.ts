import {
  buildGroupMatrices,
  distributeTeamsIntoGroups,
  groupLetter,
  isLeagueFormat,
  pickQualifiers,
} from "@/lib/league";
import { prisma } from "@/lib/prisma";
import {
  computeBracketSize,
  nextPowerOf2,
} from "@/types/database";

const TX_OPTS = { maxWait: 15_000, timeout: 120_000 } as const;

/** Round awal fase gugur setelah grup (hindari bentrok dengan leg 1/2 grup). */
const KNOCKOUT_ROUND_BASE = 10;

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

type SlotKey = `${number}-${"left" | "right"}-${number}`;

function key(round: number, side: "left" | "right", position: number): SlotKey {
  return `${round}-${side}-${position}`;
}

/**
 * Entry point: knockout → bagan eliminasi; round-robin → jadwal fase grup.
 */
export async function generateCompetition(tournamentId: string) {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
  });

  if (isLeagueFormat(tournament.competitionFormat)) {
    return generateRoundRobin(tournamentId);
  }

  return generateBracket(tournamentId);
}

/**
 * Fase grup liga: bagi tim ke grup, round-robin dalam grup (1× atau 2×).
 */
export async function generateRoundRobin(tournamentId: string) {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
  });

  if (tournament.bracketLocked) {
    throw new Error("Jadwal terkunci karena sudah ada skor yang diisi.");
  }

  const groupCount = tournament.groupCount ?? 0;
  const maxTeamsPerGroup = tournament.maxTeamsPerGroup ?? 0;
  const qualifyPerGroup = tournament.qualifyPerGroup ?? 0;

  if (groupCount < 1 || maxTeamsPerGroup < 2) {
    throw new Error(
      "Atur jumlah grup dan maksimal tim per grup di Edit turnamen sebelum membuat jadwal liga."
    );
  }
  if (qualifyPerGroup < 1) {
    throw new Error(
      "Atur berapa tim yang lolos per grup ke fase gugur di Edit turnamen."
    );
  }
  if (qualifyPerGroup > maxTeamsPerGroup) {
    throw new Error(
      "Tim lolos per grup tidak boleh melebihi maksimal tim per grup."
    );
  }

  const teams = await prisma.team.findMany({
    where: { tournamentId, status: "confirmed" },
    select: { id: true },
    orderBy: { confirmedAt: "asc" },
  });

  const groups = distributeTeamsIntoGroups(
    teams.map((t) => t.id),
    groupCount,
    maxTeamsPerGroup
  );

  const activeGroups = groups.filter((g) => g.length >= 2);
  if (activeGroups.length < 1) {
    throw new Error("Setiap grup yang dipakai minimal 2 tim.");
  }

  const isDouble = tournament.competitionFormat === "double_round_robin";

  let matchCount = 0;
  await prisma.$transaction(async (tx) => {
    await tx.match.deleteMany({ where: { tournamentId } });
    await tx.bracketSlot.deleteMany({ where: { tournamentId } });

    const slotRows: {
      tournamentId: string;
      round: number;
      side: string;
      position: number;
      groupIndex: number;
      teamId: string;
      isBye: boolean;
    }[] = [];

    for (let gi = 0; gi < groups.length; gi++) {
      const members = groups[gi];
      if (members.length === 0) continue;
      const letter = groupLetter(gi);
      members.forEach((teamId, position) => {
        slotRows.push({
          tournamentId,
          round: 1,
          side: letter,
          position,
          groupIndex: gi,
          teamId,
          isBye: false,
        });
      });
    }

    const createdSlots = await tx.bracketSlot.createManyAndReturn({
      data: slotRows,
    });

    const slotByTeam = new Map(
      createdSlots.map((s) => [s.teamId!, s.id] as const)
    );

    const matchRows: {
      tournamentId: string;
      round: number;
      groupIndex: number;
      slotAId: string;
      slotBId: string;
      winnerSlotId: null;
      notes: string;
    }[] = [];

    for (let gi = 0; gi < groups.length; gi++) {
      const members = groups[gi];
      if (members.length < 2) continue;
      const letter = groupLetter(gi);
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const a = members[i];
          const b = members[j];
          matchRows.push({
            tournamentId,
            round: 1,
            groupIndex: gi,
            slotAId: slotByTeam.get(a)!,
            slotBId: slotByTeam.get(b)!,
            winnerSlotId: null,
            notes: `Grup ${letter}`,
          });
          if (isDouble) {
            matchRows.push({
              tournamentId,
              round: 2,
              groupIndex: gi,
              slotAId: slotByTeam.get(b)!,
              slotBId: slotByTeam.get(a)!,
              winnerSlotId: null,
              notes: `Grup ${letter} · Leg 2`,
            });
          }
        }
      }
    }

    matchCount = matchRows.length;
    if (matchRows.length) {
      await tx.match.createMany({ data: matchRows });
    }

    await tx.tournament.update({
      where: { id: tournamentId },
      data: {
        bracketSize: null,
        status: "ongoing",
        bracketLocked: false,
      },
    });
  }, TX_OPTS);

  return {
    mode: isDouble ? "double_round_robin" : "single_round_robin",
    teamCount: teams.length,
    groupCount,
    maxTeamsPerGroup,
    qualifyPerGroup,
    matchCount,
    byeCount: 0,
    bracketSize: 0,
  };
}

/**
 * Setelah fase grup selesai: buat bagan gugur dari tim yang lolos.
 * Mempertahankan slot/match grup yang sudah ada.
 */
export async function generateKnockoutFromGroups(tournamentId: string) {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
  });

  if (!isLeagueFormat(tournament.competitionFormat)) {
    throw new Error("Hanya untuk sistem liga dengan fase grup.");
  }
  if (!tournament.bracketLocked) {
    throw new Error("Tetapkan bagan dulu sebelum membuat fase gugur.");
  }

  const qualifyPerGroup = tournament.qualifyPerGroup ?? 0;
  if (qualifyPerGroup < 1) {
    throw new Error("Atur jumlah tim lolos per grup di Edit turnamen.");
  }

  const pendingGroup = await prisma.match.count({
    where: {
      tournamentId,
      groupIndex: { not: null },
      resultType: null,
    },
  });
  if (pendingGroup > 0) {
    throw new Error(
      `Masih ada ${pendingGroup} pertandingan grup belum selesai.`
    );
  }

  const existingKo = await prisma.match.count({
    where: { tournamentId, groupIndex: null, round: { gte: KNOCKOUT_ROUND_BASE } },
  });
  if (existingKo > 0) {
    throw new Error("Fase gugur sudah dibuat.");
  }

  const [groupMatches, groupSlots] = await Promise.all([
    prisma.match.findMany({
      where: { tournamentId, groupIndex: { not: null } },
      include: {
        slotA: { include: { team: true } },
        slotB: { include: { team: true } },
      },
    }),
    prisma.bracketSlot.findMany({
      where: { tournamentId, groupIndex: { not: null } },
      include: { team: true },
    }),
  ]);

  const matrices = buildGroupMatrices(groupMatches, groupSlots);
  const qualifiers = pickQualifiers(matrices, qualifyPerGroup);
  if (qualifiers.length < 2) {
    throw new Error("Minimal 2 tim lolos untuk fase gugur.");
  }

  const bracketSize = nextPowerOf2(qualifiers.length);
  if (bracketSize > 64) {
    throw new Error("Jumlah tim lolos terlalu banyak untuk bagan (maks 64).");
  }

  const shuffled = shuffle(qualifiers.map((q) => q.teamId));
  const byeCount = bracketSize - shuffled.length;
  const round1Entries: (
    | { teamId: string; isBye: false }
    | { teamId: null; isBye: true }
  )[] = [
    ...shuffled.map((id) => ({ teamId: id, isBye: false as const })),
    ...Array.from({ length: byeCount }, () => ({
      teamId: null,
      isBye: true as const,
    })),
  ];
  const placed = shuffle(round1Entries);
  const half = bracketSize / 2;
  const totalRounds = Math.log2(bracketSize);
  const roundOffset = KNOCKOUT_ROUND_BASE - 1;

  type SlotDraft = {
    round: number;
    side: "left" | "right";
    position: number;
    teamId: string | null;
    isBye: boolean;
  };

  const drafts = new Map<SlotKey, SlotDraft>();

  for (let r = 1; r <= totalRounds; r++) {
    const round = r + roundOffset;
    const slotsThisRound = bracketSize / 2 ** (r - 1);
    const perSide = slotsThisRound / 2;
    for (const side of ["left", "right"] as const) {
      for (let position = 0; position < perSide; position++) {
        let teamId: string | null = null;
        let isBye = false;
        if (r === 1) {
          const idx = side === "left" ? position : half + position;
          const entry = placed[idx];
          teamId = entry.teamId;
          isBye = entry.isBye;
        }
        drafts.set(key(round, side, position), {
          round,
          side,
          position,
          teamId,
          isBye,
        });
      }
    }
  }

  for (let r = 1; r < totalRounds; r++) {
    const round = r + roundOffset;
    const nextRound = round + 1;
    const slotsThisRound = bracketSize / 2 ** (r - 1);
    const perSide = slotsThisRound / 2;
    for (const side of ["left", "right"] as const) {
      for (let position = 0; position < perSide; position += 2) {
        const a = drafts.get(key(round, side, position))!;
        const b = drafts.get(key(round, side, position + 1))!;
        const next = drafts.get(
          key(nextRound, side, Math.floor(position / 2))
        )!;
        if (a.isBye && b.isBye) {
          next.teamId = null;
          next.isBye = true;
        } else if (a.isBye !== b.isBye) {
          const winner = a.isBye ? b : a;
          if (winner.teamId) {
            next.teamId = winner.teamId;
            next.isBye = false;
          }
        }
      }
    }
  }

  type MatchDraft = {
    tournamentId: string;
    round: number;
    slotAKey: SlotKey;
    slotBKey: SlotKey;
    winnerSlotKey: SlotKey | null;
    resultType?: "wo";
    winnerTeamId?: string | null;
    notes?: string;
    scoreA?: number;
    scoreB?: number;
  };

  const matchDrafts: MatchDraft[] = [];

  for (let r = 1; r < totalRounds; r++) {
    const round = r + roundOffset;
    const nextRound = round + 1;
    const slotsThisRound = bracketSize / 2 ** (r - 1);
    const perSide = slotsThisRound / 2;
    for (const side of ["left", "right"] as const) {
      for (let position = 0; position < perSide; position += 2) {
        const slotAKey = key(round, side, position);
        const slotBKey = key(round, side, position + 1);
        const winnerSlotKey = key(
          nextRound,
          side,
          Math.floor(position / 2)
        );
        const draft: MatchDraft = {
          tournamentId,
          round,
          slotAKey,
          slotBKey,
          winnerSlotKey,
          notes: "Fase gugur",
        };
        const a = drafts.get(slotAKey)!;
        const b = drafts.get(slotBKey)!;
        if (a.isBye && b.isBye) {
          draft.resultType = "wo";
          draft.winnerTeamId = null;
          draft.notes = "BYE vs BYE — dilewati";
          draft.scoreA = 0;
          draft.scoreB = 0;
        } else if (a.isBye !== b.isBye) {
          const winnerTeamId = a.isBye ? b.teamId : a.teamId;
          if (winnerTeamId) {
            draft.resultType = "wo";
            draft.winnerTeamId = winnerTeamId;
            draft.notes = `BYE otomatis (slot ${a.isBye ? "A" : "B"})`;
            draft.scoreA = a.isBye ? 0 : 1;
            draft.scoreB = b.isBye ? 0 : 1;
          }
        }
        matchDrafts.push(draft);
      }
    }
  }

  const finalRound = totalRounds + roundOffset;
  matchDrafts.push({
    tournamentId,
    round: finalRound,
    slotAKey: key(finalRound, "left", 0),
    slotBKey: key(finalRound, "right", 0),
    winnerSlotKey: null,
    notes: "Final",
  });

  await prisma.$transaction(async (tx) => {
    const createdSlots = await tx.bracketSlot.createManyAndReturn({
      data: [...drafts.values()].map((d) => ({
        tournamentId,
        round: d.round,
        side: d.side,
        position: d.position,
        groupIndex: null,
        teamId: d.teamId,
        isBye: d.isBye,
      })),
    });

    const slotIds = new Map<SlotKey, string>();
    for (const s of createdSlots) {
      slotIds.set(
        key(s.round, s.side as "left" | "right", s.position),
        s.id
      );
    }

    await tx.match.createMany({
      data: matchDrafts.map((m) => ({
        tournamentId,
        round: m.round,
        groupIndex: null,
        slotAId: slotIds.get(m.slotAKey)!,
        slotBId: slotIds.get(m.slotBKey)!,
        winnerSlotId: m.winnerSlotKey ? slotIds.get(m.winnerSlotKey)! : null,
        resultType: m.resultType ?? null,
        winnerTeamId: m.winnerTeamId ?? null,
        notes: m.notes ?? null,
        scoreA: m.scoreA ?? null,
        scoreB: m.scoreB ?? null,
      })),
    });

    await tx.tournament.update({
      where: { id: tournamentId },
      data: {
        bracketSize,
        status: "ongoing",
      },
    });
  }, TX_OPTS);

  return {
    mode: "knockout_from_groups" as const,
    qualifierCount: qualifiers.length,
    bracketSize,
    byeCount,
    matchCount: matchDrafts.length,
  };
}

/**
 * Buat/acak bagan dari tim confirmed saat ini.
 * Ukuran = 2^n terdekat; sisa slot = BYE. Auto-advance BYE.
 */
export async function generateBracket(tournamentId: string) {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
  });

  if (tournament.bracketLocked) {
    throw new Error("Bagan terkunci karena sudah ada skor babak 1.");
  }

  const teams = await prisma.team.findMany({
    where: { tournamentId, status: "confirmed" },
    select: { id: true },
  });

  if (teams.length < 2) {
    throw new Error("Minimal 2 tim confirmed untuk membuat bagan.");
  }

  const bracketSize = computeBracketSize(teams.length, tournament.maxTeams);

  const shuffled = shuffle(teams.map((t) => t.id));
  const byeCount = bracketSize - shuffled.length;
  const round1Entries: (
    | { teamId: string; isBye: false }
    | { teamId: null; isBye: true }
  )[] = [
    ...shuffled.map((id) => ({ teamId: id, isBye: false as const })),
    ...Array.from({ length: byeCount }, () => ({
      teamId: null,
      isBye: true as const,
    })),
  ];
  const placed = shuffle(round1Entries);

  const half = bracketSize / 2;
  const totalRounds = Math.log2(bracketSize);

  type SlotDraft = {
    round: number;
    side: "left" | "right";
    position: number;
    teamId: string | null;
    isBye: boolean;
  };

  const drafts = new Map<SlotKey, SlotDraft>();

  for (let round = 1; round <= totalRounds; round++) {
    const slotsThisRound = bracketSize / 2 ** (round - 1);
    const perSide = slotsThisRound / 2;
    for (const side of ["left", "right"] as const) {
      for (let position = 0; position < perSide; position++) {
        let teamId: string | null = null;
        let isBye = false;
        if (round === 1) {
          const idx = side === "left" ? position : half + position;
          const entry = placed[idx];
          teamId = entry.teamId;
          isBye = entry.isBye;
        }
        drafts.set(key(round, side, position), {
          round,
          side,
          position,
          teamId,
          isBye,
        });
      }
    }
  }

  // Cascade auto-advance BYE melalui semua babak (bukan hanya R1→R2)
  for (let round = 1; round < totalRounds; round++) {
    const slotsThisRound = bracketSize / 2 ** (round - 1);
    const perSide = slotsThisRound / 2;
    for (const side of ["left", "right"] as const) {
      for (let position = 0; position < perSide; position += 2) {
        const a = drafts.get(key(round, side, position))!;
        const b = drafts.get(key(round, side, position + 1))!;
        const next = drafts.get(
          key(round + 1, side, Math.floor(position / 2))
        )!;
        if (a.isBye && b.isBye) {
          next.teamId = null;
          next.isBye = true;
        } else if (a.isBye !== b.isBye) {
          const winner = a.isBye ? b : a;
          // Hanya advance jika sisi non-BYE sudah punya tim
          if (winner.teamId) {
            next.teamId = winner.teamId;
            next.isBye = false;
          }
        }
        // keduanya tim / masih menunggu skor → slot berikutnya diisi nanti
      }
    }
  }

  type MatchDraft = {
    tournamentId: string;
    round: number;
    slotAKey: SlotKey;
    slotBKey: SlotKey;
    winnerSlotKey: SlotKey | null;
    resultType?: "wo";
    winnerTeamId?: string | null;
    notes?: string;
    scoreA?: number;
    scoreB?: number;
  };

  const matchDrafts: MatchDraft[] = [];

  for (let round = 1; round < totalRounds; round++) {
    const slotsThisRound = bracketSize / 2 ** (round - 1);
    const perSide = slotsThisRound / 2;
    for (const side of ["left", "right"] as const) {
      for (let position = 0; position < perSide; position += 2) {
        const slotAKey = key(round, side, position);
        const slotBKey = key(round, side, position + 1);
        const winnerSlotKey = key(
          round + 1,
          side,
          Math.floor(position / 2)
        );

        const draft: MatchDraft = {
          tournamentId,
          round,
          slotAKey,
          slotBKey,
          winnerSlotKey,
        };

        const a = drafts.get(slotAKey)!;
        const b = drafts.get(slotBKey)!;
        if (a.isBye && b.isBye) {
          draft.resultType = "wo";
          draft.winnerTeamId = null;
          draft.notes = "BYE vs BYE — dilewati";
          draft.scoreA = 0;
          draft.scoreB = 0;
        } else if (a.isBye !== b.isBye) {
          const winnerTeamId = a.isBye ? b.teamId : a.teamId;
          if (winnerTeamId) {
            draft.resultType = "wo";
            draft.winnerTeamId = winnerTeamId;
            draft.notes = `BYE otomatis (slot ${a.isBye ? "A" : "B"})`;
            draft.scoreA = a.isBye ? 0 : 1;
            draft.scoreB = b.isBye ? 0 : 1;
          }
        }

        matchDrafts.push(draft);
      }
    }
  }

  matchDrafts.push({
    tournamentId,
    round: totalRounds,
    slotAKey: key(totalRounds, "left", 0),
    slotBKey: key(totalRounds, "right", 0),
    winnerSlotKey: null,
  });

  await prisma.$transaction(async (tx) => {
    await tx.match.deleteMany({ where: { tournamentId } });
    await tx.bracketSlot.deleteMany({ where: { tournamentId } });

    const createdSlots = await tx.bracketSlot.createManyAndReturn({
      data: [...drafts.values()].map((d) => ({
        tournamentId,
        round: d.round,
        side: d.side,
        position: d.position,
        teamId: d.teamId,
        isBye: d.isBye,
      })),
    });

    const slotIds = new Map<SlotKey, string>();
    for (const s of createdSlots) {
      slotIds.set(
        key(s.round, s.side as "left" | "right", s.position),
        s.id
      );
    }

    const matchRows = matchDrafts.map((m) => ({
      tournamentId,
      round: m.round,
      slotAId: slotIds.get(m.slotAKey)!,
      slotBId: slotIds.get(m.slotBKey)!,
      winnerSlotId: m.winnerSlotKey ? slotIds.get(m.winnerSlotKey)! : null,
      resultType: m.resultType ?? null,
      winnerTeamId: m.winnerTeamId ?? null,
      notes: m.notes ?? null,
      scoreA: m.scoreA ?? null,
      scoreB: m.scoreB ?? null,
    }));

    if (matchRows.length) {
      await tx.match.createMany({ data: matchRows });
    }

    await tx.tournament.update({
      where: { id: tournamentId },
      data: {
        bracketSize,
        status: "ongoing",
        bracketLocked: false,
      },
    });
  }, TX_OPTS);

  return { bracketSize, teamCount: teams.length, byeCount };
}

export async function submitMatchResult(params: {
  matchId: string;
  resultType: "score" | "wo" | "dq";
  scoreA?: number | null;
  scoreB?: number | null;
  /** Kosong = seri (round-robin) */
  winnerTeamId?: string | null;
  forfeitedTeamId?: string | null;
  notes?: string | null;
  adminId: string;
}) {
  const match = await prisma.match.findUniqueOrThrow({
    where: { id: params.matchId },
    include: { slotA: true, slotB: true, tournament: true },
  });

  if (match.scheduledAt && match.scheduledAt > new Date()) {
    throw new Error("Jadwal pertandingan belum lewat.");
  }

  const isRr = isLeagueFormat(match.tournament.competitionFormat);
  const isGroupMatch = isRr && match.groupIndex != null;

  const winnerId = params.winnerTeamId || null;
  const validTeams = [match.slotA.teamId, match.slotB.teamId].filter(
    Boolean
  ) as string[];

  if (winnerId && !validTeams.includes(winnerId)) {
    throw new Error("Pemenang harus salah satu tim di pertandingan ini.");
  }

  if (!isRr && !winnerId) {
    throw new Error("Pilih pemenang.");
  }

  if (
    isRr &&
    params.resultType === "score" &&
    params.scoreA != null &&
    params.scoreB != null &&
    params.scoreA === params.scoreB
  ) {
    // seri — winner null OK
  } else if (!winnerId && params.resultType !== "score") {
    throw new Error("WO/DQ wajib menentukan pemenang.");
  }

  if (!match.tournament.bracketLocked) {
    throw new Error(
      "Bagan belum ditetapkan. Tetapkan bagan di menu Acak/bagan sebelum mengisi skor."
    );
  }

  let shouldStartKnockout = false;

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: {
        resultType: params.resultType,
        scoreA: params.scoreA ?? null,
        scoreB: params.scoreB ?? null,
        winnerTeamId: winnerId,
        forfeitedTeamId: params.forfeitedTeamId ?? null,
        notes: params.notes ?? null,
      },
    });

    if (match.winnerSlotId && winnerId) {
      await tx.bracketSlot.update({
        where: { id: match.winnerSlotId },
        data: { teamId: winnerId, isBye: false },
      });

      // Jika lawan di babak berikutnya BYE / kosong-BYE, auto-WO lanjut
      const nextMatch = await tx.match.findFirst({
        where: {
          tournamentId: match.tournamentId,
          resultType: null,
          OR: [
            { slotAId: match.winnerSlotId },
            { slotBId: match.winnerSlotId },
          ],
        },
        include: { slotA: true, slotB: true },
      });
      if (nextMatch) {
        const other =
          nextMatch.slotAId === match.winnerSlotId
            ? nextMatch.slotB
            : nextMatch.slotA;
        if (other.isBye) {
          await tx.match.update({
            where: { id: nextMatch.id },
            data: {
              resultType: "wo",
              winnerTeamId: winnerId,
              scoreA: nextMatch.slotAId === match.winnerSlotId ? 1 : 0,
              scoreB: nextMatch.slotBId === match.winnerSlotId ? 1 : 0,
              notes: "BYE otomatis (lanjutan)",
            },
          });
          if (nextMatch.winnerSlotId) {
            await tx.bracketSlot.update({
              where: { id: nextMatch.winnerSlotId },
              data: { teamId: winnerId, isBye: false },
            });
          } else {
            // Final — turnamen selesai
            await tx.tournament.update({
              where: { id: match.tournamentId },
              data: { status: "done" },
            });
          }
        }
      }
    }

    if (isGroupMatch) {
      const remainingGroup = await tx.match.count({
        where: {
          tournamentId: match.tournamentId,
          groupIndex: { not: null },
          resultType: null,
        },
      });
      const koExists = await tx.match.count({
        where: {
          tournamentId: match.tournamentId,
          groupIndex: null,
          round: { gte: KNOCKOUT_ROUND_BASE },
        },
      });
      if (remainingGroup === 0 && koExists === 0) {
        shouldStartKnockout = true;
      }
    } else if (!isRr) {
      const maxRound = await tx.match.aggregate({
        where: { tournamentId: match.tournamentId },
        _max: { round: true },
      });
      if (
        match.round === maxRound._max.round &&
        !match.winnerSlotId &&
        winnerId
      ) {
        await tx.tournament.update({
          where: { id: match.tournamentId },
          data: { status: "done" },
        });
      }
    } else {
      // Fase gugur setelah grup (atau sisa match tanpa grup)
      const remaining = await tx.match.count({
        where: {
          tournamentId: match.tournamentId,
          resultType: null,
        },
      });
      if (remaining === 0 && winnerId && !match.winnerSlotId) {
        await tx.tournament.update({
          where: { id: match.tournamentId },
          data: { status: "done" },
        });
      } else if (remaining === 0) {
        const openFinal = await tx.match.findFirst({
          where: {
            tournamentId: match.tournamentId,
            groupIndex: null,
            winnerSlotId: null,
            winnerTeamId: { not: null },
          },
        });
        if (openFinal) {
          await tx.tournament.update({
            where: { id: match.tournamentId },
            data: { status: "done" },
          });
        }
      }
    }
  }, TX_OPTS);

  if (shouldStartKnockout) {
    try {
      await generateKnockoutFromGroups(match.tournamentId);
    } catch (e) {
      console.error("generateKnockoutFromGroups after group stage", e);
    }
  }
}
