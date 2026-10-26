import { AdminPageShell } from "@/components/admin-page-shell";
import { ManagerPasswordActions } from "@/components/manager-password-actions";
import { requireSelectedTournament } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import {
  TEAM_STATUS_LABEL,
  whatsappChatHref,
} from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { hasAcceptedCurrentRules } from "@/lib/tournament-rules";

export default async function AdminManajerPage() {
  const profile = await requireRole("admin");
  const tournament = await requireSelectedTournament();

  const teams = await prisma.team.findMany({
    where: { tournamentId: tournament.id },
    include: {
      captain: true,
      _count: { select: { players: true, payments: true } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  const captainIds = [...new Set(teams.map((t) => t.captainId))];
  const emailRows =
    captainIds.length === 0
      ? []
      : await prisma.$queryRawUnsafe<{ id: string; email: string }[]>(
          `select id::text as id, email
           from auth.users
           where id = any($1::uuid[])`,
          captainIds
        );
  const emailById = new Map(
    emailRows.map((r) => [r.id, r.email] as const)
  );

  const statusRank: Record<string, number> = {
    confirmed: 0,
    awaiting_confirm: 1,
    pending_payment: 2,
    rejected: 3,
  };
  teams.sort(
    (a, b) =>
      (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9) ||
      a.name.localeCompare(b.name, "id")
  );

  const confirmed = teams.filter((t) => t.status === "confirmed").length;
  const withRulesCount = teams.filter((t) =>
    hasAcceptedCurrentRules({
      rulesVersion: tournament.rulesVersion,
      rulesAcceptedVersion: t.rulesAcceptedVersion,
    })
  ).length;

  return (
    <AdminPageShell
      profile={profile}
      title="Rekap manajer"
      description={`${tournament.name} — daftar manajer/tim, kontak, status, dan reset password.`}
    >
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Total tim / manajer
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {teams.length}
            </p>
          </div>
          <div className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Pembayaran confirmed
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">{confirmed}</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Peraturan disetujui
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {withRulesCount} / {teams.length}
            </p>
          </div>
        </div>

        {teams.length === 0 ? (
          <p className="panel mt-6 p-6 text-sm text-[var(--muted)]">
            Belum ada tim terdaftar di turnamen ini.
          </p>
        ) : (
          <div className="panel mt-6 overflow-x-auto p-0">
            <table className="w-full min-w-[56rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-4 py-3 font-medium">No</th>
                  <th className="px-4 py-3 font-medium">Manajer</th>
                  <th className="px-4 py-3 font-medium">Tim</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Telepon</th>
                  <th className="px-4 py-3 font-medium">RW / kota</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Pemain</th>
                  <th className="px-4 py-3 font-medium">Peraturan</th>
                  <th className="px-4 py-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team, i) => {
                  const email = emailById.get(team.captainId) ?? null;
                  const phone =
                    team.contactPhone?.trim() ||
                    team.captain.phone?.trim() ||
                    null;
                  const managerName =
                    team.captain.fullName?.trim() ||
                    team.coachName?.trim() ||
                    "—";
                  const rulesOk = hasAcceptedCurrentRules({
                    rulesVersion: tournament.rulesVersion,
                    rulesAcceptedVersion: team.rulesAcceptedVersion,
                  });
                  const wa = whatsappChatHref(
                    phone,
                    `Halo ${managerName}, terkait tim "${team.name}" di ${tournament.name}.`
                  );

                  return (
                    <tr
                      key={team.id}
                      className="border-b border-white/5 align-top"
                    >
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{managerName}</p>
                        {team.coachName?.trim() &&
                          team.coachName.trim() !== managerName && (
                            <p className="mt-0.5 text-xs text-[var(--muted)]">
                              Pelatih: {team.coachName}
                            </p>
                          )}
                      </td>
                      <td className="px-4 py-3 text-white">{team.name}</td>
                      <td className="px-4 py-3">
                        {email ? (
                          <a
                            href={`mailto:${email}`}
                            className="text-[var(--accent)] hover:underline"
                          >
                            {email}
                          </a>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {phone ? (
                          <div className="space-y-1">
                            <p className="text-white">{phone}</p>
                            {wa && (
                              <a
                                href={wa}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-emerald-300 hover:underline"
                              >
                                WhatsApp
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white">
                        {team.city?.trim() || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-white">
                        {TEAM_STATUS_LABEL[team.status] ?? team.status}
                        {team.rejectionNote && team.status === "rejected" && (
                          <p className="mt-1 max-w-[10rem] text-xs text-red-300">
                            {team.rejectionNote}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white">
                        {team._count.players}
                        <span className="text-[var(--muted)]">
                          {" "}
                          / {tournament.maxPlayersPerTeam}
                        </span>
                        <p className="text-xs text-[var(--muted)]">
                          {team._count.payments} bukti bayar
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {rulesOk ? (
                          <span className="text-emerald-300">Disetujui</span>
                        ) : (
                          <span className="text-amber-200">Belum</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ManagerPasswordActions
                          userId={team.captainId}
                          email={email}
                          teamName={team.name}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </AdminPageShell>
  );
}
