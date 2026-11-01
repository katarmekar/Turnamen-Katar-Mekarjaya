import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageShell } from "@/components/admin-page-shell";
import { AdminUserViewPicker } from "@/components/admin-user-view-picker";
import { requireSelectedTournament } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isRosterLocked } from "@/lib/roster-lock";

export default async function AdminTampilanUserPemainPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string }>;
}) {
  const profile = await requireRole("admin");
  const tournament = await requireSelectedTournament();
  const params = await searchParams;
  const teamId = params.teamId?.trim();
  if (!teamId) redirect("/admin/tampilan-user");

  const teams = await prisma.team.findMany({
    where: { tournamentId: tournament.id },
    select: { id: true, name: true, city: true, status: true },
    orderBy: { name: "asc" },
  });

  const team = await prisma.team.findFirst({
    where: { id: teamId, tournamentId: tournament.id },
    include: {
      players: {
        orderBy: [{ jerseyNumber: "asc" }, { fullName: "asc" }],
        include: {
          documents: { select: { id: true, docType: true } },
        },
      },
    },
  });
  if (!team) redirect("/admin/tampilan-user");

  const rosterLocked = await isRosterLocked(tournament.id);

  return (
    <AdminPageShell
      profile={profile}
      title="Tampilan user · Pemain"
      description={`${team.name}${team.city?.trim() ? ` · ${team.city.trim()}` : ""}`}
    >
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <AdminUserViewPicker
          teams={teams}
          selectedTeamId={team.id}
          basePath="/admin/tampilan-user/pemain"
        />
        <Link
          href={`/admin/tampilan-user?teamId=${team.id}`}
          className="btn-ghost border border-white/15"
        >
          ← Ringkasan preview
        </Link>
      </div>

      <p className="mt-4 text-sm text-[var(--muted)]">
        Ini tampilan daftar pemain seperti manajer.{" "}
        {rosterLocked
          ? "Roster terkunci oleh jadwal (manajer hanya bisa melihat)."
          : "Manajer masih bisa menambah/mengubah data."}{" "}
        Untuk kelola penuh, buka menu{" "}
        <Link href="/admin/pemain" className="text-white underline">
          Pemain & berkas
        </Link>
        .
      </p>

      <div className="panel mt-6 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-[var(--muted)]">
              <th className="px-4 py-3 font-medium">No.</th>
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">Posisi</th>
              <th className="px-4 py-3 font-medium">Berkas</th>
            </tr>
          </thead>
          <tbody>
            {team.players.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-[var(--muted)]"
                >
                  Belum ada pemain.
                </td>
              </tr>
            ) : (
              team.players.map((p) => (
                <tr key={p.id} className="border-b border-white/5 text-white">
                  <td className="px-4 py-3">
                    {p.jerseyNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3">{p.fullName}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {p.position ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {p.documents.length} berkas
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminPageShell>
  );
}
