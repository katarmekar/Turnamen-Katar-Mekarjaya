import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageShell } from "@/components/admin-page-shell";
import { AdminUserViewPicker } from "@/components/admin-user-view-picker";
import { requireSelectedTournament } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import { TEAM_STATUS_LABEL, formatIdr } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function AdminTampilanUserTimPage({
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
      tournament: true,
      payments: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!team) redirect("/admin/tampilan-user");

  const t = team.tournament;
  const canUpload = ["pending_payment", "rejected"].includes(team.status);

  return (
    <AdminPageShell
      profile={profile}
      title="Tampilan user · Pembayaran"
      description={`${team.name}${team.city?.trim() ? ` · ${team.city.trim()}` : ""}`}
    >
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <AdminUserViewPicker
          teams={teams}
          selectedTeamId={team.id}
          basePath="/admin/tampilan-user/tim"
        />
        <Link
          href={`/admin/tampilan-user?teamId=${team.id}`}
          className="btn-ghost border border-white/15"
        >
          ← Ringkasan preview
        </Link>
      </div>

      <div className="panel mt-6 max-w-2xl p-6">
        <h2 className="text-xl font-semibold text-white">{team.name}</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {t.name} · Status:{" "}
          <span className="text-white">
            {TEAM_STATUS_LABEL[team.status] ?? team.status}
          </span>
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--muted)]">Biaya pendaftaran</dt>
            <dd className="text-white">{formatIdr(t.registrationFee)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--muted)]">Bank</dt>
            <dd className="text-white">
              {t.bankName ?? "—"} · {t.bankAccountNumber ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--muted)]">Atas nama</dt>
            <dd className="text-white">{t.bankAccountHolder ?? "—"}</dd>
          </div>
        </dl>

        <p className="mt-4 text-sm text-[var(--muted)]">
          {canUpload
            ? "Di sisi manajer: form upload bukti pembayaran tampil di sini."
            : team.status === "awaiting_confirm"
              ? "Manajer menunggu konfirmasi admin."
              : "Pembayaran sudah diproses / dikonfirmasi."}
        </p>

        {team.payments.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm">
            {team.payments.map((p) => (
              <li key={p.id} className="text-[var(--muted)]">
                Upload {p.createdAt.toLocaleString("id-ID")}
                {p.amount != null ? ` · ${formatIdr(p.amount)}` : ""}
                {p.note ? ` · ${p.note}` : ""}
              </li>
            ))}
          </ul>
        )}

        <Link
          href="/admin/pembayaran"
          className="btn-primary mt-6 inline-flex"
        >
          Kelola di Konfirmasi pembayaran
        </Link>
      </div>
    </AdminPageShell>
  );
}
