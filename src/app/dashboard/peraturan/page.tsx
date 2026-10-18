import Link from "next/link";
import { AcceptRulesForm } from "@/components/accept-rules-form";
import { RulesDocument } from "@/components/rules-document";
import { SiteHeader } from "@/components/site-header";
import { requireProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ensureDefaultTournamentRules,
  hasAcceptedCurrentRules,
} from "@/lib/tournament-rules";

type PageProps = {
  searchParams: Promise<{ teamId?: string }>;
};

export default async function DashboardPeraturanPage({ searchParams }: PageProps) {
  const profile = await requireProfile();
  const params = await searchParams;

  const teams = await prisma.team.findMany({
    where: { captainId: profile.id },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          rulesVersion: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const team =
    (params.teamId ? teams.find((t) => t.id === params.teamId) : null) ??
    teams[0] ??
    null;

  if (!team) {
    return (
      <div className="hex-grid min-h-screen">
        <SiteHeader profile={profile} compactNav />
        <main className="mx-auto max-w-3xl px-4 py-10">
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-white">
            Peraturan
          </h1>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Daftarkan tim terlebih dahulu untuk melihat dan menyetujui
            peraturan.
          </p>
          <Link
            href="/dashboard/daftar-tim"
            className="btn-primary mt-6 inline-flex"
          >
            Daftar tim
          </Link>
        </main>
      </div>
    );
  }

  await ensureDefaultTournamentRules(team.tournamentId);

  const rules = await prisma.tournamentRule.findMany({
    where: { tournamentId: team.tournamentId },
    orderBy: [{ pasalNumber: "asc" }, { createdAt: "asc" }],
  });

  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: team.tournamentId },
    select: {
      name: true,
      rulesVersion: true,
      rulesHeaderEyebrow: true,
      rulesHeaderTitle: true,
      rulesHeaderSubtitle: true,
      rulesHeaderMeta: true,
    },
  });

  const accepted = hasAcceptedCurrentRules({
    rulesVersion: tournament.rulesVersion,
    rulesAcceptedVersion: team.rulesAcceptedVersion,
  });

  return (
    <div className="hex-grid min-h-screen">
      <SiteHeader profile={profile} compactNav />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href="/dashboard"
          className="text-sm text-[var(--muted)] underline-offset-2 hover:underline"
        >
          ← Dashboard
        </Link>
        <p className="mt-4 text-sm uppercase tracking-[0.25em] text-[var(--accent)]">
          Wajib dibaca
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl tracking-wide text-white sm:text-5xl">
          Peraturan turnamen
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Baca dokumen di bawah, lalu setujui di bagian paling bawah. Tim{" "}
          {team.name}.
        </p>

        {teams.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {teams.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/peraturan?teamId=${t.id}`}
                className={
                  t.id === team.id
                    ? "rounded-md border border-[var(--accent)]/50 bg-[var(--accent)]/15 px-3 py-1.5 text-xs text-white"
                    : "rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[var(--muted)] hover:text-white"
                }
              >
                {t.name}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8">
          <RulesDocument
            tournamentName={tournament.name}
            rulesVersion={tournament.rulesVersion}
            headerEyebrow={tournament.rulesHeaderEyebrow}
            headerTitle={tournament.rulesHeaderTitle}
            headerSubtitle={tournament.rulesHeaderSubtitle}
            headerMeta={tournament.rulesHeaderMeta}
            rules={rules}
            emptyMessage="Belum ada peraturan dari admin. Hubungi panitia."
          />
        </div>

        <div className="panel mt-8 p-6">
          <h2 className="text-lg font-semibold text-white">Persetujuan</h2>
          <p className="mt-1 mb-4 text-sm text-[var(--muted)]">
            Setelah membaca seluruh peraturan di atas, setujui di sini. Jadwal
            pertandingan baru muncul setelah disetujui.
          </p>
          <AcceptRulesForm teamId={team.id} alreadyAccepted={accepted} />
        </div>
      </main>
    </div>
  );
}
