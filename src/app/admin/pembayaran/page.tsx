import { AdminSectionNav } from "@/components/admin-section-nav";
import { SiteHeader } from "@/components/site-header";
import { ActionForm } from "@/components/action-form-status";
import { confirmPayment, rejectPayment } from "@/app/actions/admin";
import { requireSelectedTournament } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import { TEAM_STATUS_LABEL, formatIdr } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPembayaranPage() {
  const profile = await requireRole("admin");
  const tournament = await requireSelectedTournament();

  const teams = await prisma.team.findMany({
    where: {
      tournamentId: tournament.id,
      status: {
        in: ["awaiting_confirm", "rejected", "pending_payment", "confirmed"],
      },
    },
    include: {
      tournament: true,
      captain: true,
      payments: { orderBy: { createdAt: "desc" }, take: 3 },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  // Prioritas tampil: menunggu konfirmasi → ditolak/pending → sudah confirmed
  const statusRank: Record<string, number> = {
    awaiting_confirm: 0,
    rejected: 1,
    pending_payment: 2,
    confirmed: 3,
  };
  teams.sort(
    (a, b) =>
      (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9) ||
      b.updatedAt.getTime() - a.updatedAt.getTime()
  );

  const service = createServiceClient();
  const supabase = service ?? (await createClient());

  const withUrls = await Promise.all(
    teams.map(async (team) => {
      const payment = team.payments[0] ?? null;
      let proofUrl: string | null = null;
      if (payment?.proofPath) {
        const { data } = await supabase.storage
          .from("payment-proofs")
          .createSignedUrl(payment.proofPath, 3600);
        proofUrl = data?.signedUrl ?? null;
      }
      return { team, payment, proofUrl };
    })
  );

  const awaiting = withUrls.filter((x) => x.team.status === "awaiting_confirm");
  const confirmed = withUrls.filter((x) => x.team.status === "confirmed");
  const others = withUrls.filter(
    (x) =>
      x.team.status !== "awaiting_confirm" && x.team.status !== "confirmed"
  );

  return (
    <div className="hex-grid min-h-screen">
      <SiteHeader profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <AdminSectionNav homeHref="/admin/panel" />
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl tracking-wide text-white">
          Konfirmasi pembayaran
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {tournament.name} · {awaiting.length} menunggu · {confirmed.length}{" "}
          terkonfirmasi
        </p>

        <div className="mt-6 space-y-4">
          {withUrls.length === 0 && (
            <p className="text-sm text-[var(--muted)]">
              Belum ada tim terdaftar di turnamen ini.
            </p>
          )}

          {[...awaiting, ...others, ...confirmed].map(
            ({ team, payment, proofUrl }) => {
              const isConfirmed = team.status === "confirmed";
              const canReview =
                team.status === "awaiting_confirm" && payment != null;

              return (
                <div key={team.id} className="panel p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{team.name}</p>
                      <p className="text-sm text-[var(--muted)]">
                        {formatIdr(team.tournament.registrationFee)} ·{" "}
                        {TEAM_STATUS_LABEL[team.status] ?? team.status}
                        {team.city ? ` · ${team.city}` : ""}
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        Kapten: {team.captain.fullName ?? "—"} ·{" "}
                        {team.contactPhone ?? "—"}
                      </p>
                      {team.coachName && (
                        <p className="text-sm text-[var(--muted)]">
                          Pelatih/kapten: {team.coachName}
                        </p>
                      )}
                      {payment && (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Bukti diupload:{" "}
                          {new Intl.DateTimeFormat("id-ID", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(payment.createdAt)}
                          {payment.note ? ` · ${payment.note}` : ""}
                        </p>
                      )}
                      {team.rejectionNote && team.status === "rejected" && (
                        <p className="mt-1 text-sm text-red-300">
                          Alasan tolak: {team.rejectionNote}
                        </p>
                      )}
                    </div>
                    {proofUrl ? (
                      <a
                        href={proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost border border-white/15 text-sm"
                      >
                        Lihat bukti
                      </a>
                    ) : payment ? (
                      <span className="text-xs text-[var(--muted)]">
                        Bukti tidak bisa dibuka
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">
                        Belum upload bukti
                      </span>
                    )}
                  </div>

                  {canReview && (
                    <div className="mt-4 flex flex-wrap gap-3">
                      <ActionForm action={confirmPayment} className="inline">
                        <input type="hidden" name="team_id" value={team.id} />
                        <input
                          type="hidden"
                          name="payment_id"
                          value={payment.id}
                        />
                        <button type="submit" className="btn-primary">
                          Confirm pembayaran
                        </button>
                      </ActionForm>
                      <ActionForm
                        action={rejectPayment}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <input type="hidden" name="team_id" value={team.id} />
                        <input
                          type="hidden"
                          name="payment_id"
                          value={payment.id}
                        />
                        <input
                          name="note"
                          className="input"
                          placeholder="Alasan tolak"
                        />
                        <button
                          type="submit"
                          className="btn-ghost border border-red-400/40 text-red-300"
                        >
                          Tolak
                        </button>
                      </ActionForm>
                    </div>
                  )}

                  {isConfirmed && (
                    <div className="mt-4">
                      <button
                        type="button"
                        disabled
                        className="btn-ghost cursor-default border border-emerald-400/40 bg-emerald-500/10 text-emerald-300 opacity-100"
                      >
                        Pembayaran telah terkonfirmasi
                      </button>
                      {team.confirmedAt && (
                        <p className="mt-2 text-xs text-[var(--muted)]">
                          Dikonfirmasi:{" "}
                          {new Intl.DateTimeFormat("id-ID", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(team.confirmedAt)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>
      </main>
    </div>
  );
}
