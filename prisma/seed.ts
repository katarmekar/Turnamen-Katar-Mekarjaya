/**
 * Seed opsional — contoh: buat turnamen draft.
 * Jalankan: npm run db:seed
 *
 * Admin: setelah register via Auth, promote dengan SQL:
 *   update profiles set role = 'admin' where id = '<user-uuid>';
 */

import { PrismaClient, TournamentStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.tournament.findFirst({
    where: { name: "Turnamen Bola Demo" },
  });

  if (existing) {
    console.log("Turnamen demo sudah ada:", existing.id);
    return;
  }

  const tournament = await prisma.tournament.create({
    data: {
      name: "Turnamen Bola Demo",
      description: "Turnamen contoh — ubah data rekening & biaya di admin.",
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
