import { AdminSectionNav } from "@/components/admin-section-nav";
import { SiteHeader } from "@/components/site-header";
import { ActionForm } from "@/components/action-form-status";
import {
  deletePlayerField,
  savePlayerField,
  seedDefaultPlayerFields,
} from "@/app/actions/player-fields";
import { requireSelectedTournament } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import { ensureDefaultPlayerFields } from "@/lib/player-fields";
import { prisma } from "@/lib/prisma";

const cellInput = "input w-full min-w-0 py-1.5 text-sm";
const th =
  "px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted)]";
const td = "px-3 py-2 align-middle";

export default async function AdminFormPemainPage() {
  const profile = await requireRole("admin");
  const tournament = await requireSelectedTournament();
  await ensureDefaultPlayerFields(tournament.id);

  const fields = await prisma.tournamentPlayerField.findMany({
    where: { tournamentId: tournament.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="hex-grid min-h-screen">
      <SiteHeader profile={profile} />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <AdminSectionNav homeHref="/admin/panel" />
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl tracking-wide text-white">
          Form data pemain
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {tournament.name} — atur field yang tampil di form “Tambah pemain”
          kapten. Ubah lalu tekan Simpan di baris yang sama.
        </p>

        <div className="panel mt-6 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
            <p className="text-sm font-medium text-white">
              Field form ({fields.length})
            </p>
            <form action={seedDefaultPlayerFields}>
              <button
                type="submit"
                className="btn-ghost border border-white/15 text-xs"
              >
                Isi field default
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-sm md:min-w-[62rem]">
              <colgroup>
                <col className="w-[26%]" />
                <col className="w-[24%]" />
                <col className="w-[11%]" />
                <col className="w-[5%]" />
                <col className="w-[5%]" />
                <col className="w-[5%]" />
                <col className="w-[24%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-white/10">
                  <th className={th}>Label</th>
                  <th className={th}>Placeholder</th>
                  <th className={th}>Tipe</th>
                  <th className={`${th} text-center`}>Urut</th>
                  <th className={`${th} text-center`} title="Wajib diisi">
                    Wajib
                  </th>
                  <th className={`${th} text-center`} title="Tampil di form">
                    Tampil
                  </th>
                  <th className={th}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => {
                  const formId = `pf-save-${field.id}`;
                  return (
                    <tr
                      key={field.id}
                      className="border-b border-white/5 last:border-b-0"
                    >
                      <td className={td}>
                        <input
                          form={formId}
                          name="label"
                          required
                          className={cellInput}
                          defaultValue={field.label}
                          aria-label="Label"
                        />
                      </td>
                      <td className={td}>
                        <input
                          form={formId}
                          name="placeholder"
                          className={cellInput}
                          defaultValue={field.placeholder ?? ""}
                          aria-label="Placeholder"
                        />
                      </td>
                      <td className={td}>
                        {field.key === "jersey_number" ? (
                          <>
                            <input
                              form={formId}
                              type="hidden"
                              name="field_type"
                              value="number"
                            />
                            <select
                              className={cellInput}
                              defaultValue="number"
                              disabled
                              aria-label="Tipe"
                            >
                              <option value="text">Teks</option>
                              <option value="number">Angka</option>
                              <option value="date">Tanggal</option>
                            </select>
                          </>
                        ) : (
                          <select
                            form={formId}
                            name="field_type"
                            className={cellInput}
                            defaultValue={field.fieldType}
                            aria-label="Tipe"
                          >
                            <option value="text">Teks</option>
                            <option value="number">Angka</option>
                            <option value="date">Tanggal</option>
                          </select>
                        )}
                      </td>
                      <td className={td}>
                        <input
                          form={formId}
                          name="sort_order"
                          type="number"
                          className={`${cellInput} text-center`}
                          defaultValue={field.sortOrder}
                          aria-label="Urutan"
                        />
                      </td>
                      <td className={`${td} text-center`}>
                        <input
                          form={formId}
                          type="checkbox"
                          name="required"
                          className="size-4 align-middle"
                          defaultChecked={field.required}
                          disabled={field.locked}
                          aria-label="Wajib"
                        />
                      </td>
                      <td className={`${td} text-center`}>
                        <input
                          form={formId}
                          type="checkbox"
                          name="active"
                          value="true"
                          className="size-4 align-middle"
                          defaultChecked={field.active}
                          disabled={field.locked}
                          aria-label="Tampil"
                        />
                      </td>
                      <td className={td}>
                        <div className="flex flex-wrap items-center gap-2">
                          <ActionForm
                            id={formId}
                            action={savePlayerField}
                            className="flex flex-col items-start gap-0.5"
                            compactStatus
                          >
                            <input type="hidden" name="id" value={field.id} />
                            <input type="hidden" name="key" value={field.key} />
                            <button
                              type="submit"
                              className="btn-primary px-3 py-1.5 text-xs"
                            >
                              Simpan
                            </button>
                          </ActionForm>
                          {!field.locked ? (
                            <ActionForm
                              action={deletePlayerField}
                              className="flex flex-col items-start gap-0.5"
                              compactStatus
                            >
                              <input type="hidden" name="id" value={field.id} />
                              <button
                                type="submit"
                                className="btn-ghost border border-red-400/40 px-3 py-1.5 text-xs text-red-300"
                              >
                                Hapus
                              </button>
                            </ActionForm>
                          ) : (
                            <span className="px-1 text-xs text-[var(--muted)]">
                              —
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10 bg-white/[0.03]">
                  <td className={td} colSpan={7}>
                    <ActionForm
                      action={savePlayerField}
                      className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1.4fr_1.3fr_9rem_4.5rem_auto_auto]"
                      compactStatus
                    >
                      <label className="flex min-w-0 flex-col gap-1">
                        <span className="text-xs text-[var(--muted)]">
                          Label *
                        </span>
                        <input
                          name="label"
                          required
                          className={cellInput}
                          placeholder="Contoh: Tinggi badan"
                          aria-label="Label field baru"
                        />
                      </label>
                      <label className="flex min-w-0 flex-col gap-1">
                        <span className="text-xs text-[var(--muted)]">
                          Placeholder
                        </span>
                        <input
                          name="placeholder"
                          className={cellInput}
                          placeholder="Opsional"
                          aria-label="Placeholder field baru"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-[var(--muted)]">Tipe</span>
                        <select
                          name="field_type"
                          className={cellInput}
                          defaultValue="text"
                          aria-label="Tipe field baru"
                        >
                          <option value="text">Teks</option>
                          <option value="number">Angka</option>
                          <option value="date">Tanggal</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-[var(--muted)]">Urut</span>
                        <input
                          name="sort_order"
                          type="number"
                          className={`${cellInput} text-center`}
                          defaultValue={fields.length}
                          aria-label="Urutan field baru"
                        />
                      </label>
                      <label className="flex items-center gap-2 pb-2 text-xs text-[var(--muted)]">
                        <input
                          type="checkbox"
                          name="required"
                          className="size-4"
                          aria-label="Wajib"
                        />
                        Wajib
                      </label>
                      <button
                        type="submit"
                        className="btn-primary px-4 py-1.5 text-xs sm:mb-0.5"
                      >
                        Tambah field
                      </button>
                    </ActionForm>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
