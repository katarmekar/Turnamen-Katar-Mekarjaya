import { AdminPageShell } from "@/components/admin-page-shell";
import {
  AdminJadwalMatchList,
  type AdminJadwalMatchCard,
} from "@/components/admin-jadwal-match-list";
import { requireSelectedTournament } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import { groupLetter, isLeagueFormat } from "@/lib/league";
import { prisma } from "@/lib/prisma";

function toLocal(d: Date | null) {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatWhen(d: Date | null) {
  if (!d) return "";
  return d.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function playerEventLabel(e: {
  player: { fullName: string; jerseyNumber: number | null };
}) {
  const no =
    e.player.jerseyNumber != null ? `#${e.player.jerseyNumber} ` : "";
  return `${no}${e.player.fullName}`;
}

export default async function AdminJadwalPage() {
  const profile = await requireRole("admin");
  const tournament = await requireSelectedTournament();
  const isRr = isLeagueFormat(tournament.competitionFormat);

  const matches = await prisma.match.findMany({
    where: { tournamentId: tournament.id },
    include: {
      slotA: {
        include: {
          team: {
            include: {
              players: {
                select: {
                  id: true,
                  fullName: true,
                  jerseyNumber: true,
                },
                orderBy: [{ jerseyNumber: "asc" }, { fullName: "asc" }],
              },
            },
          },
        },
      },
      slotB: {
        include: {
          team: {
            include: {
              players: {
                select: {
                  id: true,
                  fullName: true,
                  jerseyNumber: true,
                },
                orderBy: [{ jerseyNumber: "asc" }, { fullName: "asc" }],
              },
            },
          },
        },
      },
      winnerTeam: true,
      events: {
        orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
        include: {
          player: { select: { id: true, fullName: true, jerseyNumber: true } },
        },
      },
    },
    orderBy: [
      { scheduledAt: { sort: "asc", nulls: "last" } },
      { round: "asc" },
      { createdAt: "asc" },
    ],
  });

  const cards: AdminJadwalMatchCard[] = matches.map((m) => {
    const nameA = m.slotA.isBye ? "BYE" : (m.slotA.team?.name ?? "TBD");
    const nameB = m.slotB.isBye ? "BYE" : (m.slotB.team?.name ?? "TBD");
    const phaseLabel =
      m.groupIndex != null
        ? `Grup ${groupLetter(m.groupIndex)}`
        : m.round >= 10
          ? "Fase gugur"
          : `Round ${m.round}`;
    const bothReady = Boolean(m.slotA.teamId && m.slotB.teamId);
    const bothBye = m.slotA.isBye && m.slotB.isBye;
    const hasTbd =
      (!m.slotA.teamId && !m.slotA.isBye) ||
      (!m.slotB.teamId && !m.slotB.isBye);
    const goals = m.events.filter((e) => e.type === "goal");
    const yellows = m.events.filter((e) => e.type === "yellow_card");
    const reds = m.events.filter((e) => e.type === "red_card");

    return {
      id: m.id,
      phaseLabel,
      notes: m.notes,
      nameA,
      nameB,
      scheduledAtLocal: toLocal(m.scheduledAt),
      scheduledAtLabel: formatWhen(m.scheduledAt),
      venue: m.venue ?? "",
      bothReady,
      bothBye,
      hasTbd,
      canManageScore: bothReady && !m.slotA.isBye && !m.slotB.isBye,
      showSchedule: bothReady,
      isRr,
      resultType: m.resultType,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      winnerTeamId: m.winnerTeamId,
      winnerName: m.winnerTeam?.name ?? null,
      forfeitedTeamId: m.forfeitedTeamId,
      goalsLabel:
        goals.length > 0 ? goals.map(playerEventLabel).join(", ") : null,
      yellowsLabel:
        yellows.length > 0 ? yellows.map(playerEventLabel).join(", ") : null,
      redsLabel: reds.length > 0 ? reds.map(playerEventLabel).join(", ") : null,
      teamA: m.slotA.team
        ? {
            id: m.slotA.team.id,
            name: m.slotA.team.name,
            players: m.slotA.team.players,
          }
        : null,
      teamB: m.slotB.team
        ? {
            id: m.slotB.team.id,
            name: m.slotB.team.name,
            players: m.slotB.team.players,
          }
        : null,
      events: m.events.map((e) => ({
        type: e.type,
        teamId: e.teamId,
        playerId: e.playerId,
      })),
    };
  });

  return (
    <AdminPageShell
      profile={profile}
      title="Jadwal & skor"
      description={tournament.name}
    >
      {cards.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--muted)]">
          Belum ada pertandingan. Buat bagan / jadwal dulu di menu Acak bagan.
        </p>
      ) : (
        <AdminJadwalMatchList matches={cards} />
      )}
    </AdminPageShell>
  );
}
