import { AdminPageShell } from "@/components/admin-page-shell";
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
    <AdminPageShell
      profile={profile}
      title="Kelola kartu dokumen"
      description={
        <>
          {fresh.name} — atur kartu yang muncul saat manajer upload berkas pemain.
          Kartu bertanda <strong className="text-white">wajib</strong> harus
          diupload semua. Jika tidak ada yang wajib, dipakai minimal jumlah di
          bawah.
        </>
      }
    >
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
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="required" className="size-4" />
              <span className="text-[var(--muted)]">Wajib diupload</span>
            </label>
            <button type="submit" className="btn-primary sm:col-span-2">
              Tambah kartu
            </button>
          </ActionForm>
        </div>

        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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

          {cards.length === 0 ? (
            <div className="panel p-6">
              <p className="text-sm text-[var(--muted)]">Belum ada kartu.</p>
            </div>
          ) : (
            <div className="panel overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[var(--muted)]">
                    <th className="px-3 py-3 font-medium">Nama</th>
                    <th className="px-3 py-3 font-medium">Kode</th>
                    <th className="w-20 px-3 py-3 font-medium">Urutan</th>
                    <th className="w-16 px-3 py-3 text-center font-medium">
                      Wajib
                    </th>
                    <th className="w-16 px-3 py-3 text-center font-medium">
                      Tampil
                    </th>
                    <th className="px-3 py-3 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((card) => {
                    const formId = `doc-card-${card.id}`;
                    return (
                      <tr
                        key={card.id}
                        className="border-b border-white/5 last:border-0"
                      >
                        <td className="px-3 py-2 align-middle">
                          <input type="hidden" form={formId} name="id" value={card.id} />
                          <input type="hidden" form={formId} name="key" value={card.key} />
                          <input type="hidden" form={formId} name="description" value="" />
                          <input
                            form={formId}
                            name="label"
                            required
                            className="input py-1.5"
                            defaultValue={card.label}
                            aria-label="Nama kartu"
                          />
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <code className="text-xs text-[var(--muted)]">
                            {card.key}
                          </code>
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <input
                            form={formId}
                            name="sort_order"
                            type="number"
                            className="input w-16 py-1.5"
                            defaultValue={card.sortOrder}
                            aria-label="Urutan"
                          />
                        </td>
                        <td className="px-3 py-2 text-center align-middle">
                          <input
                            form={formId}
                            type="checkbox"
                            name="required"
                            className="size-4"
                            defaultChecked={card.required}
                            aria-label="Wajib"
                          />
                        </td>
                        <td className="px-3 py-2 text-center align-middle">
                          <input
                            form={formId}
                            type="checkbox"
                            name="active"
                            value="true"
                            className="size-4"
                            defaultChecked={card.active}
                            aria-label="Tampil"
                          />
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <div className="flex items-center justify-end gap-2">
                            <ActionForm
                              action={saveDocCard}
                              id={formId}
                              compactStatus
                              className="inline"
                            >
                              <button
                                type="submit"
                                className="btn-primary px-2.5 py-1 text-xs"
                              >
                                Simpan
                              </button>
                            </ActionForm>
                            <ActionForm action={deleteDocCard}>
                              <input type="hidden" name="id" value={card.id} />
                              <button
                                type="submit"
                                className="text-xs text-red-300 hover:underline"
                              >
                                Hapus
                              </button>
                            </ActionForm>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </AdminPageShell>
  );
}
