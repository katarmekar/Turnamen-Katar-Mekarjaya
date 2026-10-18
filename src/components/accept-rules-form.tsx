"use client";

import { useActionState } from "react";
import { acceptTournamentRules } from "@/app/actions/team";

type State = { error?: string; success?: string };

export function AcceptRulesForm({
  teamId,
  alreadyAccepted,
}: {
  teamId: string;
  alreadyAccepted: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    acceptTournamentRules,
    {} as State
  );

  if (alreadyAccepted || state.success) {
    return (
      <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
        {state.success ??
          "Anda sudah menyetujui peraturan versi saat ini. Jadwal pertandingan dapat dilihat di dashboard."}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="team_id" value={teamId} />
      <label className="flex items-start gap-3 text-sm text-white">
        <input
          type="checkbox"
          name="agreed"
          value="1"
          required
          className="mt-1"
        />
        <span>
          Saya telah membaca dan menyetujui seluruh peraturan turnamen ini
          atas nama tim yang saya kelola.
        </span>
      </label>
      {state.error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Menyimpan..." : "Saya setuju peraturan"}
      </button>
    </form>
  );
}
