import { updateTeamDeposit } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form-status";
import { AdminPageShell } from "@/components/admin-page-shell";
import { IdrMoneyInput } from "@/components/idr-money-input";
import { requireSelectedTournament } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import {
  summarizeDeposit,
  toMoneyNumber,
} from "@/lib/deposit";
import { formatIdr } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function AdminDepositPage() {
  const profile = await requireRole("admin");
  const tournament = await requireSelectedTournament();

  const yellowFine = toMoneyNumber(tournament.yellowCardFine);
  const redFine = toMoneyNumber(tournament.redCardFine);
  const defaultDeposit = toMoneyNumber(tournament.defaultDeposit);

  const teams = await prisma.team.findMany({
    where: { tournamentId: tournament.id },
    select: {
      id: true,
      name: true,
      city: true,
      status: true,
      depositAmount: true,
    },
    orderBy: { name: "asc" },
  });

  const teamIds = teams.map((t) => t.id);
  const events =
    teamIds.length === 0
      ? []
      : await prisma.matchEvent.findMany({
          where: {
            teamId: { in: teamIds },
            type: { in: ["yellow_card", "red_card"] },
            match: { tournamentId: tournament.id },
          },
          select: { teamId: true, type: true },
        });

  const cardCounts = new Map<string, { yellow: number; red: number }>();
  for (const id of teamIds) {
    cardCounts.set(id, { yellow: 0, red: 0 });
  }
  for (const e of events) {
    const row = cardCounts.get(e.teamId);
    if (!row) continue;
    if (e.type === "yellow_card") row.yellow += 1;
    if (e.type === "red_card") row.red += 1;
  }

  const rows = teams.map((team) => {
    const cards = cardCounts.get(team.id) ?? { yellow: 0, red: 0 };
    const deposit = toMoneyNumber(team.depositAmount);
    const summary = summarizeDeposit(deposit, cards, {
      yellowCardFine: yellowFine,
      redCardFine: redFine,
    });
    return { team, summary };
  });

  return (
    <AdminPageShell
      profile={profile}
      title="Deposit & denda kartu"
      description={
        <>
          {tournament.name} · denda kuning {formatIdr(yellowFine)} · merah{" "}
          {formatIdr(redFine)}
          {defaultDeposit > 0 ? (
            <> · saran deposit {formatIdr(defaultDeposit)}</>
          ) : null}
        </>
      }
    >
      <p className="mt-2 text-sm text-[var(--muted)]">
        Jumlah kartu diambil otomatis dari rekap pertandingan. Sisa deposit =
        deposit − (kuning × denda kuning + merah × denda merah). Atur harga
        denda di Edit turnamen.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--muted)]">Belum ada tim.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map(({ team, summary }) => (
            <div key={team.id} className="panel p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-medium text-white">
                    {team.name}
                    {team.city?.trim() ? (
                      <span className="font-normal text-[var(--muted)]">
                        {" "}
                        · {team.city.trim()}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Kuning {summary.yellow} ({formatIdr(summary.yellowFineTotal)}
                    ) · Merah {summary.red} ({formatIdr(summary.redFineTotal)})
                    · Total denda {formatIdr(summary.fineTotal)}
                  </p>
                  <p
                    className={`mt-1 text-sm font-medium ${
                      summary.remaining < 0
                        ? "text-red-300"
                        : "text-emerald-300"
                    }`}
                  >
                    Sisa deposit: {formatIdr(summary.remaining)}
                  </p>
                </div>
              </div>

              <ActionForm
                action={updateTeamDeposit}
                className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
                compactStatus
              >
                <input type="hidden" name="team_id" value={team.id} />
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                  <span className="text-[var(--muted)]">Nominal deposit</span>
                  <IdrMoneyInput
                    name="deposit_amount"
                    defaultValue={summary.deposit}
                  />
                </label>
                <button
                  type="submit"
                  className="btn-ghost w-full border border-white/15 sm:w-auto"
                >
                  Simpan deposit
                </button>
              </ActionForm>
            </div>
          ))}
        </div>
      )}
    </AdminPageShell>
  );
}
