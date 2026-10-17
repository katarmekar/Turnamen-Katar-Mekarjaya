import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { AddPlayerForm } from "@/components/add-player-form";
import { PlayersRosterTable } from "@/components/players-roster-table";
import { requireProfile } from "@/lib/auth";
import { ensureDefaultDocCards } from "@/lib/doc-cards";
import { ensureDefaultPlayerFields } from "@/lib/player-fields";
import { prisma } from "@/lib/prisma";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function PemainPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string }>;
}) {
  const params = await searchParams;
  const profile = await requireProfile();
  if (profile.role === "admin") redirect("/admin");

  const teamId = params.teamId?.trim() || undefined;

  const team = await prisma.team.findFirst({
    where: {
      captainId: profile.id,
      status: "confirmed",
      ...(teamId ? { id: teamId } : {}),
    },
    include: {
      tournament: {
        include: {
          docCards: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          playerFields: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
      players: {
        include: { documents: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!team) {
    redirect("/dashboard/tim");
  }

  await ensureDefaultDocCards(team.tournamentId);
  await ensureDefaultPlayerFields(team.tournamentId);

  const [docCards, playerFields] = await Promise.all([
    prisma.tournamentDocCard.findMany({
      where: { tournamentId: team.tournamentId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.tournamentPlayerField.findMany({
      where: { tournamentId: team.tournamentId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const activeCards = docCards.filter((c) => c.active);
  const activeFields = playerFields.filter((f) => f.active);
  const requiredCount = activeCards.filter((c) => c.required).length;
  const minHint =
    requiredCount > 0
      ? `${requiredCount} kartu wajib`
      : `minimal ${team.tournament.minPlayerDocuments} berkas`;

  const service = createServiceClient();
  const supabase = service ?? (await createClient());
  const photoUrlByPlayerId = new Map<string, string | null>();
  await Promise.all(
    team.players.map(async (p) => {
      if (!p.photoPath) {
        photoUrlByPlayerId.set(p.id, null);
        return;
      }
      const { data } = await supabase.storage
        .from("player-docs")
        .createSignedUrl(p.photoPath, 3600);
      photoUrlByPlayerId.set(p.id, data?.signedUrl ?? null);
    })
  );

  const rosterPlayers = team.players.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    identityNumber: p.identityNumber,
    jerseyNumber: p.jerseyNumber,
    position: p.position,
    photoUrl: photoUrlByPlayerId.get(p.id) ?? null,
    extraData:
      p.extraData &&
      typeof p.extraData === "object" &&
      !Array.isArray(p.extraData)
        ? (p.extraData as Record<string, string>)
        : {},
    documents: p.documents.map((d) => ({ id: d.id, docType: d.docType })),
  }));

  const fieldDefs = activeFields.map((f) => ({
    id: f.id,
    key: f.key,
    label: f.label,
    placeholder: f.placeholder,
    fieldType: f.fieldType,
    required: f.required,
  }));

  const cardDefs = activeCards.map((c) => ({
    id: c.id,
    key: c.key,
    label: c.label,
    required: c.required,
    active: true,
  }));

  return (
    <div className="hex-grid min-h-screen">
      <SiteHeader profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Link
          href="/dashboard"
          className="text-sm text-[var(--muted)] hover:text-white"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl tracking-wide text-white sm:text-4xl">
          Pemain — {team.name}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {team.players.length} / {team.tournament.maxPlayersPerTeam} pemain ·
          tiap pemain wajib {minHint}
        </p>

        <div className="panel mt-6 p-6">
          <h2 className="font-semibold text-white">Tambah pemain</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Isi data pemain dan unggah berkas sesuai ketentuan ({minHint}), baru
            tombol Simpan aktif.
          </p>
          <div className="mt-4">
            <AddPlayerForm
              teamId={team.id}
              fields={fieldDefs}
              docCards={cardDefs}
              minPlayerDocuments={team.tournament.minPlayerDocuments}
              canAdd={
                team.players.length < team.tournament.maxPlayersPerTeam
              }
            />
          </div>
        </div>

        <div className="panel mt-6 overflow-hidden">
          <div className="border-b border-white/10 px-4 py-3">
            <h2 className="font-semibold text-white">Daftar pemain</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Edit data, tambah berkas, atau hapus pemain dari daftar.
            </p>
          </div>
          <PlayersRosterTable
            teamId={team.id}
            players={rosterPlayers}
            fields={fieldDefs}
            docCards={cardDefs}
            minPlayerDocuments={team.tournament.minPlayerDocuments}
          />
        </div>
      </main>
    </div>
  );
}
