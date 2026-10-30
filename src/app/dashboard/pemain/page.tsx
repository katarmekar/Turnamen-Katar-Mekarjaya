import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { AddPlayerForm } from "@/components/add-player-form";
import { PlayersRosterTable } from "@/components/players-roster-table";
import { requireProfile } from "@/lib/auth";
import {
  paymentReuploadRequired,
  reuploadPaymentHref,
} from "@/lib/payment-gate";
import { ensureDefaultDocCards } from "@/lib/doc-cards";
import { ensureDefaultPlayerFields } from "@/lib/player-fields";
import { prisma } from "@/lib/prisma";
import { isRosterLocked } from "@/lib/roster-lock";

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
    if (teamId) {
      const owned = await prisma.team.findFirst({
        where: { id: teamId, captainId: profile.id },
        select: { id: true, status: true },
      });
      if (owned && paymentReuploadRequired(owned.status)) {
        redirect(reuploadPaymentHref(owned.id));
      }
    }
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

  const labelByKey = Object.fromEntries(
    activeCards.map((c) => [c.key, c.label])
  );

  const rosterPlayers = team.players.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    identityNumber: p.identityNumber,
    jerseyNumber: p.jerseyNumber,
    position: p.position,
    hasPhoto: Boolean(p.photoPath),
    photoUrl: null as string | null,
    extraData:
      p.extraData &&
      typeof p.extraData === "object" &&
      !Array.isArray(p.extraData)
        ? (p.extraData as Record<string, string>)
        : {},
    documents: p.documents.map((d) => ({
      id: d.id,
      docType: d.docType,
      label: labelByKey[d.docType] ?? d.docType,
    })),
  }));

  const rosterLocked = await isRosterLocked(team.tournamentId);

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

        {rosterLocked ? (
          <div className="panel mt-6 border border-amber-400/30 p-6">
            <h2 className="font-semibold text-white">Data pemain terkunci</h2>
            <p className="mt-1 text-sm text-amber-200">
              Jadwal pertandingan pertama sudah dimulai. Tambah, edit, ganti,
              dan hapus data pemain tidak bisa dilakukan lagi.
            </p>
          </div>
        ) : (
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
        )}

        <div className="panel mt-6 overflow-hidden">
          <div className="border-b border-white/10 px-4 py-3">
            <h2 className="font-semibold text-white">Daftar pemain</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {rosterLocked
                ? "Data hanya bisa dilihat. Perubahan terkunci setelah jadwal pertandingan pertama dimulai."
                : "Edit data, tambah berkas, atau hapus pemain dari daftar."}
            </p>
          </div>
          <PlayersRosterTable
            teamId={team.id}
            players={rosterPlayers}
            fields={fieldDefs}
            docCards={cardDefs}
            minPlayerDocuments={team.tournament.minPlayerDocuments}
            locked={rosterLocked}
          />
        </div>
      </main>
    </div>
  );
}
