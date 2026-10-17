/**
 * Seed 16 tim confirmed untuk testing acak bagan.
 * Jalankan: npx tsx --env-file=.env prisma/seed-teams.ts
 */

import { randomUUID } from "crypto";
import {
  PrismaClient,
  TeamStatus,
  TournamentStatus,
  UserRole,
} from "@prisma/client";

const DUMMY_TEAMS = [
  { name: "Garuda FC", city: "Jakarta" },
  { name: "Merah Putih United", city: "Bandung" },
  { name: "Nusa Jaya", city: "Surabaya" },
  { name: "Satria Muda", city: "Yogyakarta" },
  { name: "Bintang Timur", city: "Makassar" },
  { name: "Elang Laut", city: "Medan" },
  { name: "Persikota Demo", city: "Tangerang" },
  { name: "Mandiri Sport", city: "Semarang" },
  { name: "Cahaya Selatan", city: "Denpasar" },
  { name: "Rimba Raya", city: "Palembang" },
  { name: "Delta Force FC", city: "Bekasi" },
  { name: "Puncak Jaya", city: "Bogor" },
  { name: "Samudra Biru", city: "Batam" },
  { name: "Laskar Api", city: "Malang" },
  { name: "Harimau Hitam", city: "Solo" },
  { name: "Angkasa FC", city: "Depok" },
] as const;

function slugEmail(name: string, index: number) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return `dummy.${index + 1}.${slug}@turnamen.test`;
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

async function main() {
  if (process.env.DIRECT_URL) {
    process.env.DATABASE_URL = process.env.DIRECT_URL;
  }

  const prisma = new PrismaClient();

  try {
    let tournament = await prisma.tournament.findFirst({
      where: { name: "Turnamen Bola Demo" },
    });

    if (!tournament) {
      tournament = await prisma.tournament.create({
        data: {
          name: "Turnamen Bola Demo",
          description: "Turnamen contoh untuk testing acak bagan.",
          maxTeams: 16,
          registrationFee: 500000,
          bankName: "BCA",
          bankAccountNumber: "1234567890",
          bankAccountHolder: "Panitia Turnamen",
          maxPlayersPerTeam: 18,
          minPlayersPerTeam: 11,
          status: TournamentStatus.open,
        },
      });
      console.log("Turnamen demo dibuat:", tournament.id);
    } else {
      if (tournament.maxTeams !== 16) {
        tournament = await prisma.tournament.update({
          where: { id: tournament.id },
          data: { maxTeams: 16, status: TournamentStatus.open },
        });
      }
      console.log("Turnamen demo:", tournament.id);
    }

    let created = 0;
    let skipped = 0;

    for (let i = 0; i < DUMMY_TEAMS.length; i++) {
      const t = DUMMY_TEAMS[i];
      const existing = await prisma.team.findFirst({
        where: { tournamentId: tournament.id, name: t.name },
      });

      if (existing) {
        if (existing.status !== TeamStatus.confirmed) {
          await prisma.team.update({
            where: { id: existing.id },
            data: {
              status: TeamStatus.confirmed,
              confirmedAt: existing.confirmedAt ?? new Date(),
            },
          });
          console.log("Update confirmed:", t.name);
        } else {
          console.log("Skip (sudah ada):", t.name);
        }
        skipped += 1;
        continue;
      }

      const captainId = randomUUID();
      const fullName = `Kapten ${t.name}`;
      const email = slugEmail(t.name, i);

      await ensureAuthUser(prisma, captainId, email, fullName);

      await prisma.profile.upsert({
        where: { id: captainId },
        create: {
          id: captainId,
          fullName,
          phone: `0812345678${String(i).padStart(2, "0")}`,
          role: UserRole.captain,
        },
        update: {
          fullName,
          role: UserRole.captain,
        },
      });

      await prisma.team.create({
        data: {
          tournamentId: tournament.id,
          captainId,
          name: t.name,
          city: t.city,
          contactPhone: `0812345678${String(i).padStart(2, "0")}`,
          contactEmail: email,
          coachName: `Pelatih ${t.name}`,
          status: TeamStatus.confirmed,
          confirmedAt: new Date(),
        },
      });

      created += 1;
      console.log("OK:", t.name);
    }

    const confirmed = await prisma.team.count({
      where: { tournamentId: tournament.id, status: TeamStatus.confirmed },
    });

    console.log("---");
    console.log(`Dibuat: ${created}, dilewati/diupdate: ${skipped}`);
    console.log(`Tim confirmed di turnamen: ${confirmed}`);
    console.log("Siap testing acak di /admin/bagan");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
