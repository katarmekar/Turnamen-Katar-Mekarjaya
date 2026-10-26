import { AdminPageShell } from "@/components/admin-page-shell";
import { RuleEditorPanel } from "@/components/rule-editor-panel";
import { RulesDocument } from "@/components/rules-document";
import { RulesHeaderEditor } from "@/components/rules-header-editor";
import { seedDefaultTournamentRules } from "@/app/actions/rules";
import { requireSelectedTournament } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import {
  ensureDefaultTournamentRules,
  parseRulePoints,
} from "@/lib/tournament-rules";
import { prisma } from "@/lib/prisma";

export default async function AdminPeraturanPage() {
  const profile = await requireRole("admin");
  const tournament = await requireSelectedTournament();

  await ensureDefaultTournamentRules(tournament.id);

  const [fresh, rules] = await Promise.all([
    prisma.tournament.findUniqueOrThrow({ where: { id: tournament.id } }),
    prisma.tournamentRule.findMany({
      where: { tournamentId: tournament.id },
      orderBy: [{ pasalNumber: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const nextPasal =
    rules.reduce((max, r) => Math.max(max, r.pasalNumber), 0) + 1;

  return (
    <AdminPageShell
      profile={profile}
      title="Peraturan turnamen"
      description={`${fresh.name} · versi ${fresh.rulesVersion}. Edit header dokumen, lalu setiap pasal (nomor, judul, isi).`}
    >
        {rules.length === 0 && (
          <div className="panel mt-6 p-6">
            <p className="text-sm text-[var(--muted)]">
              Belum ada pasal. Muat template default atau tambah manual di bawah.
            </p>
            <form action={seedDefaultTournamentRules} className="mt-4">
              <button type="submit" className="btn-ghost border border-white/15">
                Muat dari PDF Katar Mekarjaya Cup 2026
              </button>
            </form>
          </div>
        )}

        <div className="mt-6 space-y-4">
          <RulesHeaderEditor
            defaultEyebrow={fresh.rulesHeaderEyebrow}
            defaultTitle={fresh.rulesHeaderTitle}
            defaultSubtitle={fresh.rulesHeaderSubtitle}
            defaultMeta={
              (fresh.rulesHeaderMeta ?? "").trim() ||
              `${fresh.name} · Versi ${fresh.rulesVersion}`
            }
          />

          {rules.map((rule) => (
            <RuleEditorPanel
              key={rule.id}
              mode="edit"
              id={rule.id}
              defaultPasalNumber={rule.pasalNumber}
              defaultTitle={rule.title}
              defaultDescription={rule.description}
              defaultPoints={parseRulePoints(rule.points)}
            />
          ))}
        </div>

        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-white">
            Tambah pasal baru
          </h2>
          <RuleEditorPanel mode="create" defaultPasalNumber={nextPasal} />
        </div>

        <div className="mt-10">
          <h2 className="mb-3 text-lg font-semibold text-white">
            Pratinjau dokumen
          </h2>
          <RulesDocument
            tournamentName={fresh.name}
            rulesVersion={fresh.rulesVersion}
            headerEyebrow={fresh.rulesHeaderEyebrow}
            headerTitle={fresh.rulesHeaderTitle}
            headerSubtitle={fresh.rulesHeaderSubtitle}
            headerMeta={fresh.rulesHeaderMeta}
            rules={rules}
          />
        </div>
    </AdminPageShell>
  );
}
