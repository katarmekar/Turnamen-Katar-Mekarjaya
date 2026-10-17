import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { PaymentProofUpload } from "@/components/payment-proof-upload";
import { requireProfile } from "@/lib/auth";
import {
  TEAM_STATUS_LABEL,
  formatIdr,
  toWhatsappNumber,
  whatsappChatHref,
} from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function TimPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string; teamId?: string }>;
}) {
  const params = await searchParams;
  const profile = await requireProfile();
  if (profile.role === "admin") redirect("/admin");

  const teamId = params.teamId?.trim() || undefined;

  const team = await prisma.team.findFirst({
    where: {
      captainId: profile.id,
      ...(teamId ? { id: teamId } : {}),
    },
    include: {
      tournament: true,
      payments: { orderBy: { createdAt: "desc" }, take: 3 },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!team) redirect("/dashboard/daftar-tim");

  const otherTeams = await prisma.team.findMany({
    where: { captainId: profile.id, NOT: { id: team.id } },
    include: { tournament: true },
    orderBy: { createdAt: "desc" },
  });

  const t = team.tournament;
  const canUpload = ["pending_payment", "rejected"].includes(team.status);
  const awaitingConfirm = team.status === "awaiting_confirm";

  const waHref = whatsappChatHref(
    t.adminWhatsapp,
    `Halo Admin, saya manajer tim "${team.name}" (${t.name}). Bukti transfer sudah diupload. Mohon dikonfirmasi. Terima kasih.`
  );
  const waDisplay = t.adminWhatsapp?.trim() || null;
  const waNormalized = toWhatsappNumber(t.adminWhatsapp);

  return (
    <div className="hex-grid min-h-screen">
      <SiteHeader profile={profile} />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Link
          href="/dashboard"
          className="text-sm text-[var(--muted)] hover:text-white"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl tracking-wide text-white">
          {team.name}
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          {t.name} · Status:{" "}
          <span className="text-white">
            {TEAM_STATUS_LABEL[team.status] ?? team.status}
          </span>
        </p>

        {otherTeams.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs text-[var(--muted)] self-center">
              Tim lain:
            </span>
            {otherTeams.map((ot) => (
              <Link
                key={ot.id}
                href={`/dashboard/tim?teamId=${ot.id}`}
                className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-[var(--muted)] hover:text-white"
              >
                {ot.name}
              </Link>
            ))}
          </div>
        )}

        {params.registered && (
          <p className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            Tim terdaftar. Silakan transfer biaya lalu upload bukti.
          </p>
        )}

        {team.rejectionNote && (
          <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {team.rejectionNote}
          </p>
        )}

        <div className="panel mt-6 space-y-3 p-6 text-sm">
          <h2 className="text-lg font-semibold text-white">Transfer biaya</h2>
          <p className="text-[var(--muted)]">
            Transfer{" "}
            <strong className="text-white">
              {formatIdr(t.registrationFee)}
            </strong>{" "}
            ke:
          </p>
          <dl className="space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Bank</dt>
              <dd className="text-white">{t.bankName ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">No. rekening</dt>
              <dd className="font-mono text-white">
                {t.bankAccountNumber ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Atas nama</dt>
              <dd className="text-white">{t.bankAccountHolder ?? "—"}</dd>
            </div>
          </dl>
        </div>

        {canUpload && (
          <div className="panel mt-4 p-6">
            <h2 className="text-lg font-semibold text-white">
              Upload bukti transfer
            </h2>
            <PaymentProofUpload teamId={team.id} />
          </div>
        )}

        {awaitingConfirm && (
          <div className="panel mt-4 space-y-4 border-amber-400/30 p-6">
            <h2 className="text-lg font-semibold text-white">
              Beritahu admin
            </h2>
            <p className="text-sm text-[var(--muted)]">
              Bukti transfer sudah terkirim dan menunggu konfirmasi. Hubungi
              admin agar pembayaran segera dicek.
            </p>
            {waHref ? (
              <>
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center justify-center gap-2"
                >
                  Chat WhatsApp admin
                </a>
                <p className="text-xs text-[var(--muted)]">
                  {waDisplay}
                  {waNormalized ? ` · wa.me/${waNormalized}` : ""}
                </p>
              </>
            ) : (
              <p className="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                Nomor WhatsApp admin belum diatur untuk turnamen ini. Hubungi
                panitia secara manual.
              </p>
            )}
          </div>
        )}

        {team.status === "confirmed" && (
          <div className="panel mt-4 p-6">
            <p className="text-sm text-emerald-300">
              {t.bracketLocked
                ? "Pembayaran dikonfirmasi. Bagan sudah ditetapkan, data pemain hanya bisa dilihat."
                : "Pembayaran dikonfirmasi. Anda dapat mengisi data pemain."}
            </p>
            <Link
              href={`/dashboard/pemain?teamId=${team.id}`}
              className="btn-primary mt-4 inline-flex"
            >
              {t.bracketLocked ? "Lihat pemain" : "Kelola pemain"}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
