import { AdminPageShell } from "@/components/admin-page-shell";
import {
  AdminTeamsPlayersList,
  type AdminTeamPlayersView,
} from "@/components/admin-teams-players-list";
import { requireSelectedTournament } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ teamId?: string }>;
};

export default async function AdminPemainPage({ searchParams }: PageProps) {
  const profile = await requireRole("admin");
  const tournament = await requireSelectedTournament();
  const params = await searchParams;
  const focusTeamId = params.teamId?.trim() || null;

  const [teams, docCards] = await Promise.all([
    prisma.team.findMany({
      where: { tournamentId: tournament.id },
      include: {
        players: {
          include: { documents: { orderBy: { createdAt: "asc" } } },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { players: true } },
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
    prisma.tournamentDocCard.findMany({
      where: { tournamentId: tournament.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const labelByKey = Object.fromEntries(docCards.map((c) => [c.key, c.label]));

  const service = createServiceClient();
  const supabase = service ?? (await createClient());

  const docPaths = teams.flatMap((t) =>
    t.players.flatMap((p) =>
      p.documents.map((d) => ({
        id: d.id,
        path: d.filePath,
      }))
    )
  );

  const urlByDocId = new Map<string, string | null>();
  const photoUrlByPlayerId = new Map<string, string | null>();
  await Promise.all([
    ...docPaths.map(async ({ id, path }) => {
      const { data } = await supabase.storage
        .from("player-docs")
        .createSignedUrl(path, 3600);
      urlByDocId.set(id, data?.signedUrl ?? null);
    }),
    ...teams.flatMap((t) =>
      t.players.map(async (p) => {
        if (!p.photoPath) {
          photoUrlByPlayerId.set(p.id, null);
          return;
        }
        const { data } = await supabase.storage
          .from("player-docs")
          .createSignedUrl(p.photoPath, 3600);
        photoUrlByPlayerId.set(p.id, data?.signedUrl ?? null);
      })
    ),
  ]);

  const totalPlayers = teams.reduce((n, t) => n + t._count.players, 0);
  const totalDocs = docPaths.length;

  const statusRank: Record<string, number> = {
    confirmed: 0,
    awaiting_confirm: 1,
    pending_payment: 2,
    rejected: 3,
  };
  teams.sort(
    (a, b) =>
      (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9) ||
      a.name.localeCompare(b.name, "id")
  );

  const teamViews: AdminTeamPlayersView[] = teams.map((team) => ({
    id: team.id,
    name: team.name,
    city: team.city,
    status: team.status,
    players: team.players.map((player) => ({
      id: player.id,
      fullName: player.fullName,
      jerseyNumber: player.jerseyNumber,
      position: player.position,
      identityNumber: player.identityNumber,
      photoUrl: photoUrlByPlayerId.get(player.id) ?? null,
      documents: player.documents.map((doc) => ({
        id: doc.id,
        docType: doc.docType,
        label: labelByKey[doc.docType] ?? doc.docType,
        url: urlByDocId.get(doc.id) ?? null,
      })),
    })),
  }));

  return (
    <AdminPageShell
      profile={profile}
      title="Pemain & berkas"
      description={`${tournament.name} · ${teams.length} tim · ${totalPlayers} pemain · ${totalDocs} berkas · klik nama tim untuk buka/tutup detail`}
    >
        {teams.length === 0 ? (
          <div className="panel mt-6 p-6">
            <p className="text-sm text-[var(--muted)]">
              Belum ada tim terdaftar di turnamen ini.
            </p>
          </div>
        ) : (
          <AdminTeamsPlayersList
            teams={teamViews}
            initialOpenTeamId={focusTeamId}
          />
        )}
    </AdminPageShell>
  );
}
