/**
 * Seed LOCAL ONLY: turnamen liga 16 tim + pemain dummy.
 *
 * Guard: menolak production / Vercel.
 * Jalankan:
 *   npm run db:seed-liga:local
 *   npx tsx --env-file=.env prisma/seed-liga-local.ts
 */

import { randomUUID } from "crypto";
import {
  CompetitionFormat,
  PrismaClient,
  TeamStatus,
  TournamentStatus,
  UserRole,
} from "@prisma/client";

const TOURNAMENT_NAME = "Demo Liga 16 Tim (Local)";
const PLAYERS_PER_TEAM = 12;

const DUMMY_TEAMS = [
  { name: "Garuda Liga FC", city: "Jakarta" },
  { name: "Merah Putih Liga", city: "Bandung" },
  { name: "Nusa Jaya Liga", city: "Surabaya" },
  { name: "Satria Muda Liga", city: "Yogyakarta" },
  { name: "Bintang Timur Liga", city: "Makassar" },
  { name: "Elang Laut Liga", city: "Medan" },
  { name: "Persikota Liga", city: "Tangerang" },
  { name: "Mandiri Liga", city: "Semarang" },
  { name: "Cahaya Selatan Liga", city: "Denpasar" },
  { name: "Rimba Raya Liga", city: "Palembang" },
  { name: "Delta Force Liga", city: "Bekasi" },
  { name: "Puncak Jaya Liga", city: "Bogor" },
  { name: "Samudra Biru Liga", city: "Batam" },
  { name: "Laskar Api Liga", city: "Malang" },
  { name: "Harimau Hitam Liga", city: "Solo" },
  { name: "Angkasa Liga FC", city: "Depok" },
] as const;

const POSITIONS = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "MF", "FW", "FW", "FW"];

function assertLocalOnly() {
  if (
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production" ||
    process.env.ALLOW_LOCAL_SEED === "0"
  ) {
    console.error(
      "Seed liga dummy hanya boleh dijalankan di local (bukan production/Vercel)."
    );
    process.exit(1);
  }
}

function slugEmail(name: string, index: number) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return `liga.dummy.${index + 1}.${slug}@turnamen.local`;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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
        identityNumber: `3201${String(n).padStart(12, "0")}`,
      };
    }),
  });
  return { created: toCreate, skipped: existing };
}

/** Buat jadwal round-robin (setengah kompetisi) jika belum ada match. */
async function ensureLeagueSchedule(
  prisma: PrismaClient,
  tournamentId: string
) {
  const matchCount = await prisma.match.count({ where: { tournamentId } });
  if (matchCount > 0) {
    return { created: false, matchCount };
  }

  const teams = await prisma.team.findMany({
    where: { tournamentId, status: TeamStatus.confirmed },
    select: { id: true },
    orderBy: { confirmedAt: "asc" },
  });

  if (teams.length < 2) {
    return { created: false, matchCount: 0 };
  }

  const shuffled = shuffle(teams.map((t) => t.id));
  const half = Math.ceil(shuffled.length / 2);

  await prisma.$transaction(async (tx) => {
    await tx.match.deleteMany({ where: { tournamentId } });
    await tx.bracketSlot.deleteMany({ where: { tournamentId } });

    const createdSlots = await tx.bracketSlot.createManyAndReturn({
      data: shuffled.map((teamId, i) => ({
        tournamentId,
        round: 1,
        side: (i < half ? "left" : "right") as "left" | "right",
        position: i,
        teamId,
        isBye: false,
      })),
    });

    const slotByTeam = new Map(
      createdSlots.map((s) => [s.teamId!, s.id] as const)
    );

    const matchRows: {
      tournamentId: string;
      round: number;
      slotAId: string;
      slotBId: string;
    }[] = [];

    for (let i = 0; i < shuffled.length; i++) {
      for (let j = i + 1; j < shuffled.length; j++) {
        matchRows.push({
          tournamentId,
          round: 1,
          slotAId: slotByTeam.get(shuffled[i])!,
          slotBId: slotByTeam.get(shuffled[j])!,
        });
      }
    }

    if (matchRows.length) {
      await tx.match.createMany({ data: matchRows });
    }

    await tx.tournament.update({
      where: { id: tournamentId },
      data: {
        bracketSize: null,
        status: TournamentStatus.ongoing,
        bracketLocked: false,
      },
    });
  });

  const expected = (shuffled.length * (shuffled.length - 1)) / 2;
  return { created: true, matchCount: expected };
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
            "Data dummy lokal — sistem liga 16 tim, 4 grup (fase grup → gugur). Jangan dipakai production.",
          maxTeams: 16,
          registrationFee: 200000,
          bankName: "BCA",
          bankAccountNumber: "9876543210",
          bankAccountHolder: "Panitia Liga Demo",
          adminWhatsapp: "082240743344",
          maxPlayersPerTeam: 18,
          minPlayersPerTeam: 11,
          competitionFormat: CompetitionFormat.single_round_robin,
          groupCount: 4,
          maxTeamsPerGroup: 4,
          qualifyPerGroup: 1,
          status: TournamentStatus.open,
        },
      });
      console.log("Turnamen liga dibuat:", tournament.id);
    } else {
      tournament = await prisma.tournament.update({
        where: { id: tournament.id },
        data: {
          maxTeams: 16,
          competitionFormat: CompetitionFormat.single_round_robin,
          groupCount: 4,
          maxTeamsPerGroup: 4,
          qualifyPerGroup: 1,
          maxPlayersPerTeam: 18,
          minPlayersPerTeam: 11,
          description:
            "Data dummy lokal — sistem liga 16 tim, 4 grup (fase grup → gugur). Jangan dipakai production.",
        },
      });
      console.log("Turnamen liga sudah ada, diupdate:", tournament.id);
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
            phone: `08139900${String(i + 1).padStart(4, "0")}`,
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
            contactPhone: `08139900${String(i + 1).padStart(4, "0")}`,
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

    const schedule = await ensureLeagueSchedule(prisma, tournament.id);

    const confirmed = await prisma.team.count({
      where: { tournamentId: tournament.id, status: TeamStatus.confirmed },
    });
    const playerTotal = await prisma.player.count({
      where: { team: { tournamentId: tournament.id } },
    });

    console.log("---");
    console.log(`Turnamen: ${TOURNAMENT_NAME}`);
    console.log(`Format: single_round_robin (setengah kompetisi)`);
    console.log(`Tim dibuat: ${teamsCreated}, dilewati: ${teamsSkipped}`);
    console.log(`Pemain baru: ${playersCreated} · total pemain: ${playerTotal}`);
    console.log(`Tim confirmed: ${confirmed}`);
    console.log(
      schedule.created
        ? `Jadwal liga dibuat: ${schedule.matchCount} pertandingan`
        : `Jadwal sudah ada: ${schedule.matchCount} pertandingan`
    );
    console.log("Login manajer dummy: email *@turnamen.local · password dummy123");
    console.log("Pilih turnamen di /admin/pilih → lihat klasemen di dashboard /bagan");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
