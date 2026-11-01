import { updateTeamDeposit } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form-status";
import { AdminPageShell } from "@/components/admin-page-shell";
import { IdrMoneyInput } from "@/components/idr-money-input";
import { requireSelectedTournament } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import {
  getTournamentDepositRows,
  toMoneyNumber,
} from "@/lib/deposit";
import { formatIdr } from "@/lib/format";

export default async function AdminDepositPage() {
  const profile = await requireRole("admin");
  const tournament = await requireSelectedTournament();

  const yellowFine = toMoneyNumber(tournament.yellowCardFine);
  const redFine = toMoneyNumber(tournament.redCardFine);
  const defaultDeposit = toMoneyNumber(tournament.defaultDeposit);
  const rows = await getTournamentDepositRows(tournament.id, {
    yellowCardFine: yellowFine,
    redCardFine: redFine,
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
