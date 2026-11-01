import Link from "next/link";
import { AdminPageShell } from "@/components/admin-page-shell";
import { AdminUserViewPicker } from "@/components/admin-user-view-picker";
import { TournamentBracketView } from "@/components/tournament-bracket-view";
import { requireSelectedTournament } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import { TEAM_STATUS_LABEL, formatIdr } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  paymentReuploadRequired,
  reuploadPaymentHref,
} from "@/lib/payment-gate";
import { isRosterLocked } from "@/lib/roster-lock";
import { getTournamentForBracket } from "@/lib/tournament-bracket";
import { hasAcceptedCurrentRules } from "@/lib/tournament-rules";

function formatSchedule(d: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function AdminTampilanUserPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string }>;
}) {
  const profile = await requireRole("admin");
  const tournament = await requireSelectedTournament();
  const params = await searchParams;
  const teamId = params.teamId?.trim() || null;

  const teams = await prisma.team.findMany({
    where: { tournamentId: tournament.id },
    select: {
      id: true,
      name: true,
      city: true,
      status: true,
      rejectionNote: true,
      rulesAcceptedVersion: true,
      captain: { select: { fullName: true, phone: true } },
    },
    orderBy: { name: "asc" },
  });

  const selected =
    (teamId ? teams.find((t) => t.id === teamId) : null) ?? null;

  const team = selected
    ? await prisma.team.findUnique({
        where: { id: selected.id },
        include: {
          tournament: true,
          players: {
            orderBy: [{ jerseyNumber: "asc" }, { fullName: "asc" }],
            select: {
              id: true,
              fullName: true,
              jerseyNumber: true,
              position: true,
            },
          },
          payments: { orderBy: { createdAt: "desc" }, take: 3 },
          captain: { select: { fullName: true, phone: true } },
        },
      })
    : null;

  const paymentBlocked = team
    ? paymentReuploadRequired(team.status)
    : false;
  const rulesAccepted = team
    ? hasAcceptedCurrentRules({
        rulesVersion: team.tournament.rulesVersion,
        rulesAcceptedVersion: team.rulesAcceptedVersion,
      })
    : false;

  const [matches, bracketTournament, rosterLocked] = team
    ? await Promise.all([
        rulesAccepted
          ? prisma.match.findMany({
              where: {
                tournamentId: tournament.id,
                OR: [
                  { slotA: { teamId: team.id } },
                  { slotB: { teamId: team.id } },
                ],
              },
              include: {
                slotA: { include: { team: true } },
                slotB: { include: { team: true } },
                winnerTeam: true,
              },
              orderBy: [{ scheduledAt: "asc" }, { round: "asc" }],
            })
          : Promise.resolve([]),
        getTournamentForBracket(tournament.id),
        isRosterLocked(tournament.id),
      ])
    : [[], null, false];

  return (
    <AdminPageShell
      profile={profile}
      title="Tampilan user"
      description={`${tournament.name} — lihat apa yang dilihat manajer untuk satu tim.`}
    >
      <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        Mode preview admin. Perubahan data sebaiknya lewat menu admin biasa
        (pemain, pembayaran, dll).
      </div>

      <div className="mt-6">
        <AdminUserViewPicker
          teams={teams}
          selectedTeamId={selected?.id ?? null}
        />
      </div>

      {!team ? (
        <p className="mt-8 text-sm text-[var(--muted)]">
          Pilih tim di atas untuk melihat dashboard manajer.
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          <div className="panel p-5">
            <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
              Preview dashboard manajer
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-white">
              {team.name}
              {team.city?.trim() ? (
                <span className="font-normal text-[var(--muted)]">
                  {" "}
                  · {team.city.trim()}
                </span>
              ) : null}
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Status:{" "}
              <span className="text-white">
                {TEAM_STATUS_LABEL[team.status] ?? team.status}
              </span>
              {" · "}
              Manajer: {team.captain.fullName ?? "—"}
              {team.captain.phone ? ` · ${team.captain.phone}` : ""}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/admin/tampilan-user/pemain?teamId=${team.id}`}
                className="btn-ghost border border-white/15"
              >
                Lihat pemain
              </Link>
              <Link
                href={`/admin/tampilan-user/tim?teamId=${team.id}`}
                className="btn-ghost border border-white/15"
              >
                Lihat pembayaran
              </Link>
              <Link
                href={`/admin/tampilan-user/peraturan?teamId=${team.id}`}
                className="btn-ghost border border-white/15"
              >
                Lihat peraturan
              </Link>
            </div>
          </div>

          {paymentBlocked && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-4 text-sm text-red-100">
              Bukti ditolak
              {team.rejectionNote ? ` — ${team.rejectionNote}` : ""}. Di sisi
              manajer, menu terkunci sampai upload ulang (
              <Link
                href={reuploadPaymentHref(team.id)}
                className="underline"
              >
                link upload
              </Link>
              ).
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="panel p-6">
              <h3 className="text-lg font-semibold text-white">
                Jadwal pertandingan
              </h3>
              {paymentBlocked ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Jadwal terkunci (pembayaran ditolak).
                </p>
              ) : !rulesAccepted ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Jadwal tersembunyi sampai manajer menyetujui peraturan.
                </p>
              ) : matches.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Belum ada jadwal untuk tim ini.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {matches.map((m) => {
                    const nameA = m.slotA.isBye
                      ? "BYE"
                      : (m.slotA.team?.name ?? "TBD");
                    const nameB = m.slotB.isBye
                      ? "BYE"
                      : (m.slotB.team?.name ?? "TBD");
                    const isHome = m.slotA.teamId === team.id;
                    const opponent = isHome ? nameB : nameA;
                    return (
                      <li
                        key={m.id}
                        className="rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2.5 text-sm"
                      >
                        <p className="text-white">
                          vs <span className="font-medium">{opponent}</span>
                          <span className="text-[var(--muted)]">
                            {" "}
                            · R{m.round}
                          </span>
                        </p>
                        <p className="mt-1 text-[var(--muted)]">
                          {m.scheduledAt
                            ? formatSchedule(m.scheduledAt)
                            : "Jadwal belum ditetapkan"}
                          {m.venue ? ` · ${m.venue}` : ""}
                        </p>
                        {m.resultType && (
                          <p className="mt-1 text-emerald-300">
                            Selesai
                            {m.winnerTeamId == null
                              ? " — Seri"
                              : m.winnerTeamId === team.id
                                ? " — Menang"
                                : " — Kalah"}
                            {m.scoreA != null && m.scoreB != null
                              ? ` (${m.scoreA}-${m.scoreB})`
                              : ` (${m.resultType})`}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="panel p-6">
              <h3 className="text-lg font-semibold text-white">
                Tim & pembayaran
              </h3>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted)]">Biaya</dt>
                  <dd className="text-white">
                    {formatIdr(team.tournament.registrationFee)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted)]">Peraturan</dt>
                  <dd className="text-white">
                    {rulesAccepted ? "Sudah disetujui" : "Belum disetujui"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted)]">Roster</dt>
                  <dd className="text-white">
                    {team.players.length} pemain
                    {rosterLocked ? " · terkunci jadwal" : ""}
                  </dd>
                </div>
              </dl>
              {team.payments.length > 0 && (
                <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
                  {team.payments.map((p) => (
                    <li key={p.id}>
                      Bukti {p.createdAt.toLocaleString("id-ID")}
                      {p.amount != null ? ` · ${formatIdr(p.amount)}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="panel p-6">
            <h3 className="text-lg font-semibold text-white">
              Ringkas pemain ({team.players.length})
            </h3>
            {team.players.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">Belum ada pemain.</p>
            ) : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {team.players.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-md border border-white/10 px-3 py-2 text-sm text-white"
                  >
                    {p.jerseyNumber != null ? `#${p.jerseyNumber} ` : ""}
                    {p.fullName}
                    {p.position ? (
                      <span className="text-[var(--muted)]">
                        {" "}
                        · {p.position}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {bracketTournament && (
            <div className="panel p-6">
              <h3 className="mb-4 text-lg font-semibold text-white">
                Bagan (seperti di dashboard manajer)
              </h3>
              <TournamentBracketView
                tournament={bracketTournament}
                showHeading={false}
                focusTeamId={team.id}
              />
            </div>
          )}
        </div>
      )}
    </AdminPageShell>
  );
}
