import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageShell } from "@/components/admin-page-shell";
import { AdminUserViewPicker } from "@/components/admin-user-view-picker";
import { RulesDocument } from "@/components/rules-document";
import { requireSelectedTournament } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ensureDefaultTournamentRules,
  hasAcceptedCurrentRules,
} from "@/lib/tournament-rules";

export default async function AdminTampilanUserPeraturanPage({
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
    include: { tournament: true },
  });
  if (!team) redirect("/admin/tampilan-user");

  await ensureDefaultTournamentRules(tournament.id);
  const rules = await prisma.tournamentRule.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { pasalNumber: "asc" },
  });

  const accepted = hasAcceptedCurrentRules({
    rulesVersion: team.tournament.rulesVersion,
    rulesAcceptedVersion: team.rulesAcceptedVersion,
  });

  return (
    <AdminPageShell
      profile={profile}
      title="Tampilan user · Peraturan"
      description={`${team.name}${team.city?.trim() ? ` · ${team.city.trim()}` : ""}`}
    >
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <AdminUserViewPicker
          teams={teams}
          selectedTeamId={team.id}
          basePath="/admin/tampilan-user/peraturan"
        />
        <Link
          href={`/admin/tampilan-user?teamId=${team.id}`}
          className="btn-ghost border border-white/15"
        >
          ← Ringkasan preview
        </Link>
      </div>

      <div className="mt-4 rounded-md border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
        Status persetujuan manajer:{" "}
        <span className={accepted ? "text-emerald-300" : "text-amber-200"}>
          {accepted ? "Sudah menyetujui versi saat ini" : "Belum menyetujui"}
        </span>
        <span className="text-[var(--muted)]">
          {" "}
          · v{team.tournament.rulesVersion}
        </span>
      </div>

      <div className="mt-6">
        <RulesDocument
          tournamentName={team.tournament.name}
          rulesVersion={team.tournament.rulesVersion}
          headerEyebrow={team.tournament.rulesHeaderEyebrow}
          headerTitle={team.tournament.rulesHeaderTitle}
          headerSubtitle={team.tournament.rulesHeaderSubtitle}
          headerMeta={team.tournament.rulesHeaderMeta}
          rules={rules}
          emptyMessage="Belum ada peraturan dari admin."
        />
      </div>
    </AdminPageShell>
  );
}
