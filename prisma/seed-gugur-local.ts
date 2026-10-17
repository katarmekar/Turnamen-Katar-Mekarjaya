/**
 * Seed LOCAL ONLY: turnamen sistem gugur (knockout) 16 tim + pemain + bagan.
 *
 * Guard: menolak production / Vercel.
 * Jalankan:
 *   npm run db:seed-gugur:local
 *   npx tsx --env-file=.env prisma/seed-gugur-local.ts
 */

import { randomUUID } from "crypto";
import {
  CompetitionFormat,
  PrismaClient,
  TeamStatus,
  TournamentStatus,
  UserRole,
} from "@prisma/client";

const TOURNAMENT_NAME = "Demo Gugur 16 Tim (Local)";
const PLAYERS_PER_TEAM = 12;
const BRACKET_SIZE = 16;

const DUMMY_TEAMS = [
  { name: "Garuda Gugur FC", city: "Jakarta" },
  { name: "Merah Putih Gugur", city: "Bandung" },
  { name: "Nusa Jaya Gugur", city: "Surabaya" },
  { name: "Satria Muda Gugur", city: "Yogyakarta" },
  { name: "Bintang Timur Gugur", city: "Makassar" },
  { name: "Elang Laut Gugur", city: "Medan" },
  { name: "Persikota Gugur", city: "Tangerang" },
  { name: "Mandiri Gugur", city: "Semarang" },
  { name: "Cahaya Selatan Gugur", city: "Denpasar" },
  { name: "Rimba Raya Gugur", city: "Palembang" },
  { name: "Delta Force Gugur", city: "Bekasi" },
  { name: "Puncak Jaya Gugur", city: "Bogor" },
  { name: "Samudra Biru Gugur", city: "Batam" },
  { name: "Laskar Api Gugur", city: "Malang" },
  { name: "Harimau Hitam Gugur", city: "Solo" },
  { name: "Angkasa Gugur FC", city: "Depok" },
] as const;

const POSITIONS = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "MF", "FW", "FW", "FW"];

type SlotKey = `${number}-${"left" | "right"}-${number}`;

function assertLocalOnly() {
  if (
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production" ||
    process.env.ALLOW_LOCAL_SEED === "0"
  ) {
    console.error(
      "Seed gugur dummy hanya boleh dijalankan di local (bukan production/Vercel)."
    );
    process.exit(1);
  }
}

function slugEmail(name: string, index: number) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return `gugur.dummy.${index + 1}.${slug}@turnamen.local`;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function slotKey(
  round: number,
  side: "left" | "right",
  position: number
): SlotKey {
  return `${round}-${side}-${position}`;
}

async function ensureAuthUser(
  prisma: PrismaClient,
  id: string,
  email: string,
  fullName: string
) {
  await prisma.$executeRaw`
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      ${id}::uuid,
      'authenticated',
      'authenticated',
      ${email},
      crypt('dummy123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      ${JSON.stringify({ full_name: fullName })}::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
    on conflict (id) do nothing
  `;

  await prisma.$executeRaw`
    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      ${id}::uuid,
      ${id}::uuid,
      ${JSON.stringify({ sub: id, email })}::jsonb,
      'email',
      ${id},
      now(),
      now(),
      now()
    )
    on conflict do nothing
  `;
}

async function ensureTournamentDefaults(
  prisma: PrismaClient,
  tournamentId: string
) {
  const [docCount, fieldCount] = await Promise.all([
    prisma.tournamentDocCard.count({ where: { tournamentId } }),
    prisma.tournamentPlayerField.count({ where: { tournamentId } }),
  ]);

  if (docCount === 0) {
    await prisma.tournamentDocCard.createMany({
      data: [
        { tournamentId, key: "ktp", label: "KTP", required: false, sortOrder: 0 },
        {
          tournamentId,
          key: "kk",
          label: "Kartu Keluarga (KK)",
          required: false,
          sortOrder: 1,
        },
      ],
    });
  }

  if (fieldCount === 0) {
    await prisma.tournamentPlayerField.createMany({
      data: [
        {
          tournamentId,
          key: "full_name",
          label: "Nama lengkap",
          fieldType: "text",
          required: true,
          locked: true,
          sortOrder: 0,
        },
        {
          tournamentId,
          key: "jersey_number",
          label: "No. punggung",
          fieldType: "number",
          required: false,
          locked: false,
          sortOrder: 1,
        },
        {
          tournamentId,
          key: "position",
          label: "Posisi",
          fieldType: "text",
          required: false,
          locked: false,
          sortOrder: 2,
        },
      ],
    });
  }
}

async function ensurePlayersForTeam(
  prisma: PrismaClient,
  teamId: string,
  teamName: string
) {
  const existing = await prisma.player.count({ where: { teamId } });
  if (existing >= PLAYERS_PER_TEAM) {
    return { created: 0, skipped: existing };
  }

  const toCreate = PLAYERS_PER_TEAM - existing;
  const start = existing + 1;
  await prisma.player.createMany({
    data: Array.from({ length: toCreate }, (_, i) => {
      const n = start + i;
      return {
        teamId,
        fullName: `Pemain ${n} ${teamName}`,
        jerseyNumber: n,
        position: POSITIONS[(n - 1) % POSITIONS.length],
        identityNumber: `3202${String(n).padStart(12, "0")}`,
      };
    }),
  });
  return { created: toCreate, skipped: existing };
}

/** Buat bagan knockout 16 jika belum ada match. */
async function ensureKnockoutBracket(
  prisma: PrismaClient,
  tournamentId: string
) {
  const matchCount = await prisma.match.count({ where: { tournamentId } });
  if (matchCount > 0) {
    return { created: false, matchCount, bracketSize: BRACKET_SIZE };
  }

  const teams = await prisma.team.findMany({
    where: { tournamentId, status: TeamStatus.confirmed },
    select: { id: true },
    orderBy: { confirmedAt: "asc" },
  });

  if (teams.length < 2) {
    return { created: false, matchCount: 0, bracketSize: 0 };
  }

  const bracketSize = BRACKET_SIZE;
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
        drafts.set(slotKey(round, side, position), {
          round,
          side,
          position,
          teamId,
          isBye,
        });
      }
    }
  }

  for (let round = 1; round < totalRounds; round++) {
    const slotsThisRound = bracketSize / 2 ** (round - 1);
    const perSide = slotsThisRound / 2;
    for (const side of ["left", "right"] as const) {
      for (let position = 0; position < perSide; position += 2) {
        const a = drafts.get(slotKey(round, side, position))!;
        const b = drafts.get(slotKey(round, side, position + 1))!;
        const next = drafts.get(
          slotKey(round + 1, side, Math.floor(position / 2))
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

  for (let round = 1; round < totalRounds; round++) {
    const slotsThisRound = bracketSize / 2 ** (round - 1);
    const perSide = slotsThisRound / 2;
    for (const side of ["left", "right"] as const) {
      for (let position = 0; position < perSide; position += 2) {
        const slotAKey = slotKey(round, side, position);
        const slotBKey = slotKey(round, side, position + 1);
        const winnerSlotKey = slotKey(
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
    slotAKey: slotKey(totalRounds, "left", 0),
    slotBKey: slotKey(totalRounds, "right", 0),
    winnerSlotKey: null,
    notes: "Final",
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
        slotKey(s.round, s.side as "left" | "right", s.position),
        s.id
      );
    }

    await tx.match.createMany({
      data: matchDrafts.map((m) => ({
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
      })),
    });

    await tx.tournament.update({
      where: { id: tournamentId },
      data: {
        bracketSize,
        status: TournamentStatus.ongoing,
        bracketLocked: false,
      },
    });
  });

  return { created: true, matchCount: matchDrafts.length, bracketSize };
}

async function main() {
  assertLocalOnly();

  if (process.env.DIRECT_URL) {
    process.env.DATABASE_URL = process.env.DIRECT_URL;
  }

  const prisma = new PrismaClient();

  try {
    let tournament = await prisma.tournament.findFirst({
      where: { name: TOURNAMENT_NAME },
    });

    if (!tournament) {
      tournament = await prisma.tournament.create({
        data: {
          name: TOURNAMENT_NAME,
          description:
            "Data dummy lokal — sistem gugur (knockout) 16 tim. Jangan dipakai production.",
          maxTeams: 16,
          registrationFee: 350000,
          bankName: "BCA",
          bankAccountNumber: "1122334455",
          bankAccountHolder: "Panitia Gugur Demo",
          adminWhatsapp: "082240743344",
          maxPlayersPerTeam: 18,
          minPlayersPerTeam: 11,
          competitionFormat: CompetitionFormat.knockout,
          groupCount: null,
          maxTeamsPerGroup: null,
          qualifyPerGroup: null,
          status: TournamentStatus.open,
        },
      });
      console.log("Turnamen gugur dibuat:", tournament.id);
    } else {
      tournament = await prisma.tournament.update({
        where: { id: tournament.id },
        data: {
          maxTeams: 16,
          competitionFormat: CompetitionFormat.knockout,
          groupCount: null,
          maxTeamsPerGroup: null,
          qualifyPerGroup: null,
          maxPlayersPerTeam: 18,
          minPlayersPerTeam: 11,
          description:
            "Data dummy lokal — sistem gugur (knockout) 16 tim. Jangan dipakai production.",
        },
      });
      console.log("Turnamen gugur sudah ada, diupdate:", tournament.id);
    }

    await ensureTournamentDefaults(prisma, tournament.id);

    let teamsCreated = 0;
    let teamsSkipped = 0;
    let playersCreated = 0;

    for (let i = 0; i < DUMMY_TEAMS.length; i++) {
      const t = DUMMY_TEAMS[i];
      let team = await prisma.team.findFirst({
        where: { tournamentId: tournament.id, name: t.name },
      });

      if (!team) {
        const captainId = randomUUID();
        const fullName = `Manajer ${t.name}`;
        const email = slugEmail(t.name, i);

        await ensureAuthUser(prisma, captainId, email, fullName);
        await prisma.profile.upsert({
          where: { id: captainId },
          create: {
            id: captainId,
            fullName,
            phone: `08128800${String(i + 1).padStart(4, "0")}`,
            role: UserRole.captain,
          },
          update: {
            fullName,
            role: UserRole.captain,
          },
        });

        team = await prisma.team.create({
          data: {
            tournamentId: tournament.id,
            captainId,
            name: t.name,
            city: t.city,
            contactPhone: `08128800${String(i + 1).padStart(4, "0")}`,
            contactEmail: email,
            coachName: `Pelatih ${t.name}`,
            status: TeamStatus.confirmed,
            confirmedAt: new Date(),
          },
        });
        teamsCreated += 1;
        console.log("Tim OK:", t.name);
      } else {
        if (team.status !== TeamStatus.confirmed) {
          team = await prisma.team.update({
            where: { id: team.id },
            data: {
              status: TeamStatus.confirmed,
              confirmedAt: team.confirmedAt ?? new Date(),
            },
          });
        }
        teamsSkipped += 1;
        console.log("Tim skip:", t.name);
      }

      const players = await ensurePlayersForTeam(prisma, team.id, t.name);
      playersCreated += players.created;
      if (players.created > 0) {
        console.log(`  +${players.created} pemain`);
      }
    }

    const bracket = await ensureKnockoutBracket(prisma, tournament.id);

    const confirmed = await prisma.team.count({
      where: { tournamentId: tournament.id, status: TeamStatus.confirmed },
    });
    const playerTotal = await prisma.player.count({
      where: { team: { tournamentId: tournament.id } },
    });

    console.log("---");
    console.log(`Turnamen: ${TOURNAMENT_NAME}`);
    console.log(`Format: knockout (sistem gugur)`);
    console.log(`Tim dibuat: ${teamsCreated}, dilewati: ${teamsSkipped}`);
    console.log(`Pemain baru: ${playersCreated} · total pemain: ${playerTotal}`);
    console.log(`Tim confirmed: ${confirmed}`);
    console.log(
      bracket.created
        ? `Bagan gugur dibuat: ${bracket.matchCount} pertandingan (ukuran ${bracket.bracketSize})`
        : `Bagan sudah ada: ${bracket.matchCount} pertandingan`
    );
    console.log("Login manajer dummy: email *@turnamen.local · password dummy123");
    console.log("Pilih turnamen di /admin/pilih → lihat bagan di /admin/bagan atau /bagan");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
