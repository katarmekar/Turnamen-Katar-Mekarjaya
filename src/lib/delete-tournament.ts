import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Amankan trigger Storage agar gagal hapus file tidak membatalkan DELETE tim. */
async function ensureSafeStorageCleanupTrigger() {
  await prisma.$executeRawUnsafe(`
create or replace function public.cleanup_team_storage()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $fn$
begin
  begin
    delete from storage.objects
    where bucket_id in ('payment-proofs', 'player-docs', 'team-logos')
      and (
        name like old.id::text || '/%'
        or (storage.foldername(name))[1] = old.id::text
      );
  exception
    when others then
      raise warning 'cleanup_team_storage(%) gagal: %', old.id, sqlerrm;
  end;
  return old;
end;
$fn$;
`);
}

function shortPrismaError(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2003") {
      return "Masih ada data terkait yang mengunci hapus (foreign key).";
    }
    if (err.code === "P2028" || err.code === "P2034") {
      return "Transaksi database timeout/konflik. Coba lagi.";
    }
    const cause =
      typeof err.meta?.cause === "string" ? err.meta.cause : err.message;
    return `${err.code}: ${cause}`.slice(0, 200);
  }
  if (err instanceof Error) {
    // Potong dump Prisma yang terlalu panjang
    const oneLine = err.message.replace(/\s+/g, " ").trim();
    const match = oneLine.match(/PostgresError[^}]*code:\s*"([^"]+)"/i);
    if (match) return `Postgres ${match[1]}`;
    return oneLine.slice(0, 200);
  }
  return "Gagal menghapus turnamen.";
}

/**
 * Hapus turnamen + seluruh anaknya secara berurutan.
 * Tidak mengandalkan Cascade saja (aman untuk data bagan/tim).
 */
export async function deleteTournamentCascade(tournamentId: string) {
  try {
    await ensureSafeStorageCleanupTrigger();
  } catch (err) {
    console.warn("[deleteTournament] pastikan trigger aman gagal", err);
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.match.deleteMany({ where: { tournamentId } });
      await tx.bracketSlot.deleteMany({ where: { tournamentId } });

      await tx.playerDocument.deleteMany({
        where: { player: { team: { tournamentId } } },
      });
      await tx.player.deleteMany({
        where: { team: { tournamentId } },
      });
      await tx.payment.deleteMany({
        where: { team: { tournamentId } },
      });
      await tx.team.deleteMany({ where: { tournamentId } });

      await tx.tournamentRule.deleteMany({ where: { tournamentId } });
      await tx.tournamentDocCard.deleteMany({ where: { tournamentId } });
      await tx.tournamentPlayerField.deleteMany({ where: { tournamentId } });

      await tx.tournament.delete({ where: { id: tournamentId } });
    },
    {
      maxWait: 15_000,
      timeout: 60_000,
    }
  );
}

export function formatDeleteTournamentError(err: unknown): string {
  return `Gagal menghapus turnamen. ${shortPrismaError(err)}`;
}
