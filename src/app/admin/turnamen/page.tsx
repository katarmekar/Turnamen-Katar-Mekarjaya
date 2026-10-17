import Link from "next/link";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { SiteHeader } from "@/components/site-header";
import { ActionForm } from "@/components/action-form-status";
import { saveTournament } from "@/app/actions/admin";
import { requireRole } from "@/lib/auth";
import { COMPETITION_FORMAT_LABEL, formatIdr } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<{ id?: string; baru?: string }>;
};

export default async function AdminTurnamenPage({ searchParams }: PageProps) {
  const profile = await requireRole("admin");
  const params = await searchParams;
  const isNew = params.baru === "1" || params.baru === "true";

  const tournaments = await prisma.tournament.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { teams: true } } },
  });

  const editing = !isNew && params.id
    ? tournaments.find((t) => t.id === params.id) ?? null
    : null;

  const showForm = isNew || editing != null || tournaments.length === 0;
  const active = editing;

  return (
    <div className="hex-grid min-h-screen">
      <SiteHeader profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <AdminSectionNav homeHref="/admin" />
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-white">
            Kelola turnamen
          </h1>
          {!isNew && (
            <Link href="/admin/turnamen?baru=1" className="btn-primary">
              Tambah turnamen
            </Link>
          )}
        </div>

        {showForm && (
          <div className="panel mt-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-white">
                {active ? "Edit turnamen" : "Buat turnamen baru"}
              </h2>
              {isNew && tournaments.length > 0 && (
                <Link
                  href="/admin/turnamen"
                  className="text-sm text-[var(--muted)] underline-offset-2 hover:underline"
                >
                  Batal
                </Link>
              )}
            </div>
            <ActionForm
              action={saveTournament}
              successDialog
              successTitle="Turnamen tersimpan!"
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              {active && <input type="hidden" name="id" value={active.id} />}
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-[var(--muted)]">Nama</span>
                <input
                  name="name"
                  required
                  className="input"
                  defaultValue={active?.name ?? ""}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-[var(--muted)]">Deskripsi</span>
                <textarea
                  name="description"
                  className="input min-h-20"
                  defaultValue={active?.description ?? ""}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--muted)]">Kapasitas</span>
                <select
                  name="max_teams"
                  className="input"
                  defaultValue={active?.maxTeams ?? 16}
                >
                  <option value={8}>8 tim</option>
                  <option value={16}>16 tim</option>
                  <option value={32}>32 tim</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--muted)]">Sistem kompetisi</span>
                <select
                  name="competition_format"
                  className="input"
                  defaultValue={active?.competitionFormat ?? "knockout"}
                >
                  <option value="knockout">Sistem gugur (knockout)</option>
                  <option value="single_round_robin">
                    Sistem liga — setengah kompetisi (bertemu 1×)
                  </option>
                  <option value="double_round_robin">
                    Sistem liga — kompetisi penuh (bertemu 2×)
                  </option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-[var(--muted)]">Status</span>
                <select
                  name="status"
                  className="input"
                  defaultValue={active?.status ?? "open"}
                >
                  <option value="draft">draft</option>
                  <option value="open">open (pendaftaran)</option>
                  <option value="ongoing">ongoing</option>
                  <option value="done">done</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--muted)]">Biaya (Rp)</span>
                <input
                  name="registration_fee"
                  type="number"
                  className="input"
                  defaultValue={Number(active?.registrationFee ?? 500000)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--muted)]">Bank</span>
                <input
                  name="bank_name"
                  className="input"
                  defaultValue={active?.bankName ?? ""}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--muted)]">No. rekening</span>
                <input
                  name="bank_account_number"
                  className="input"
                  defaultValue={active?.bankAccountNumber ?? ""}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--muted)]">Atas nama</span>
                <input
                  name="bank_account_holder"
                  className="input"
                  defaultValue={active?.bankAccountHolder ?? ""}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-[var(--muted)]">
                  WhatsApp admin (untuk chat kapten)
                </span>
                <input
                  name="admin_whatsapp"
                  className="input"
                  placeholder="082240743344"
                  inputMode="tel"
                  defaultValue={active?.adminWhatsapp ?? ""}
                />
                <span className="text-xs text-[var(--muted)]">
                  Nomor ini muncul di tombol WhatsApp saat kapten menunggu
                  konfirmasi pembayaran.
                </span>
              </label>
              <button type="submit" className="btn-primary sm:col-span-2">
                Simpan
              </button>
            </ActionForm>
          </div>
        )}

        <div className="mt-6 space-y-3">
          <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
            Daftar turnamen ({tournaments.length})
          </p>
          {tournaments.length === 0 && (
            <p className="text-sm text-[var(--muted)]">Belum ada turnamen.</p>
          )}
          {tournaments.map((t) => (
            <div
              key={t.id}
              className="panel flex flex-wrap items-center justify-between gap-3 p-4 text-sm"
            >
              <div>
                <p className="font-medium text-white">{t.name}</p>
                <p className="text-[var(--muted)]">
                  {t.status} ·{" "}
                  {COMPETITION_FORMAT_LABEL[t.competitionFormat] ??
                    t.competitionFormat}{" "}
                  · {formatIdr(t.registrationFee)} · {t._count.teams} tim · max{" "}
                  {t.maxTeams}
                  {t.adminWhatsapp ? ` · WA ${t.adminWhatsapp}` : " · WA belum diisi"}
                </p>
              </div>
              <Link
                href={`/admin/turnamen?id=${t.id}`}
                className="btn-ghost border border-white/15"
              >
                Edit
              </Link>
            </div>
          ))}
        </div>

        {tournaments.length > 0 && (
          <p className="mt-8 text-center text-sm text-[var(--muted)]">
            Selesai kelola?{" "}
            <Link
              href="/admin/pilih"
              className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Pilih turnamen →
            </Link>
          </p>
        )}
      </main>
    </div>
  );
}
