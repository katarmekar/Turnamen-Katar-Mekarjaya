import type { DepositSummary } from "@/lib/deposit";
import { formatIdr } from "@/lib/format";

type TeamDepositSummaryPanelProps = {
  summary: DepositSummary;
};

export function TeamDepositSummaryPanel({
  summary,
}: TeamDepositSummaryPanelProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Sisa deposit tim</h2>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-[var(--muted)]">
            Jumlah kartu kuning = {summary.yellow}
          </dt>
          <dd className="text-white">Total {formatIdr(summary.yellowFineTotal)}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-[var(--muted)]">
            Jumlah kartu merah = {summary.red}
          </dt>
          <dd className="text-white">Total {formatIdr(summary.redFineTotal)}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-white/10 pt-2">
          <dt className="font-medium text-white">Sisa Deposit tim</dt>
          <dd
            className={`font-medium ${
              summary.remaining < 0 ? "text-red-300" : "text-emerald-300"
            }`}
          >
            {formatIdr(summary.remaining)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
