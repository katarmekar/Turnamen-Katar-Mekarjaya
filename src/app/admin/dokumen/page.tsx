import { AdminSectionNav } from "@/components/admin-section-nav";
import { SiteHeader } from "@/components/site-header";
import { ActionForm } from "@/components/action-form-status";
import {
  deleteDocCard,
  saveDocCard,
  saveMinPlayerDocuments,
  seedDefaultDocCards,
} from "@/app/actions/doc-cards";
import { requireSelectedTournament } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import { ensureDefaultDocCards } from "@/lib/doc-cards";
import { prisma } from "@/lib/prisma";

export default async function AdminDokumenPage() {
  const profile = await requireRole("admin");
  const tournament = await requireSelectedTournament();

  await ensureDefaultDocCards(tournament.id);

  const [fresh, cards] = await Promise.all([
    prisma.tournament.findUniqueOrThrow({ where: { id: tournament.id } }),
    prisma.tournamentDocCard.findMany({
      where: { tournamentId: tournament.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return (
    <div className="hex-grid min-h-screen">
      <SiteHeader profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <AdminSectionNav homeHref="/admin/panel" />
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl tracking-wide text-white">
          Kelola kartu dokumen
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {fresh.name} — atur kartu yang muncul saat kapten upload berkas pemain.
          Kartu bertanda <strong className="text-white">wajib</strong> harus
          diupload semua. Jika tidak ada yang wajib, dipakai minimal jumlah di
          bawah.
        </p>

        <div className="panel mt-6 p-6">
          <h2 className="font-semibold text-white">Syarat minimal</h2>
          <ActionForm
            action={saveMinPlayerDocuments}
            className="mt-3 flex flex-wrap items-end gap-3"
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">
                Minimal berkas (jika tidak ada kartu wajib)
              </span>
              <input
                name="min_player_documents"
                type="number"
                min={0}
                max={20}
                className="input w-28"
                defaultValue={fresh.minPlayerDocuments}
              />
            </label>
            <button type="submit" className="btn-primary">
              Simpan
            </button>
          </ActionForm>
        </div>

        <div className="panel mt-4 p-6">
          <h2 className="font-semibold text-white">Tambah kartu baru</h2>
          <ActionForm
            action={saveDocCard}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-[var(--muted)]">Nama kartu *</span>
              <input
                name="label"
                required
                className="input"
                placeholder="Contoh: Kartu Pelajar"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">Kode (opsional)</span>
              <input
                name="key"
                className="input"
                placeholder="otomatis dari nama"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">Urutan</span>
              <input
                name="sort_order"
                type="number"
                className="input"
                defaultValue={cards.length}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-[var(--muted)]">Deskripsi singkat</span>
              <input name="description" className="input" />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="required" className="size-4" />
              <span className="text-[var(--muted)]">Wajib diupload</span>
            </label>
            <button type="submit" className="btn-primary sm:col-span-2">
              Tambah kartu
            </button>
          </ActionForm>
        </div>

        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
              Daftar kartu ({cards.length})
            </p>
            <form action={seedDefaultDocCards}>
              <button
                type="submit"
                className="btn-ghost border border-white/15 text-xs"
              >
                Isi kartu default
              </button>
            </form>
          </div>

          {cards.map((card) => (
            <div key={card.id} className="panel space-y-3 p-4">
              <ActionForm
                action={saveDocCard}
                className="grid gap-3 sm:grid-cols-2"
              >
                <input type="hidden" name="id" value={card.id} />
                <input type="hidden" name="key" value={card.key} />
                <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                  <span className="text-[var(--muted)]">
                    Nama · kode <code className="text-white/70">{card.key}</code>
                  </span>
                  <input
                    name="label"
                    required
                    className="input"
                    defaultValue={card.label}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                  <span className="text-[var(--muted)]">Deskripsi</span>
                  <input
                    name="description"
                    className="input"
                    defaultValue={card.description ?? ""}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-[var(--muted)]">Urutan</span>
                  <input
                    name="sort_order"
                    type="number"
                    className="input"
                    defaultValue={card.sortOrder}
                  />
                </label>
                <div className="flex flex-col gap-2 text-sm justify-end">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="required"
                      className="size-4"
                      defaultChecked={card.required}
                    />
                    <span className="text-[var(--muted)]">Wajib</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="active"
                      value="true"
                      className="size-4"
                      defaultChecked={card.active}
                    />
                    <span className="text-[var(--muted)]">Tampil ke kapten</span>
                  </label>
                </div>
                <button type="submit" className="btn-primary sm:col-span-2">
                  Simpan perubahan
                </button>
              </ActionForm>
              <ActionForm action={deleteDocCard} className="inline">
                <input type="hidden" name="id" value={card.id} />
                <button
                  type="submit"
                  className="btn-ghost border border-red-400/40 text-sm text-red-300"
                >
                  Hapus kartu
                </button>
              </ActionForm>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
