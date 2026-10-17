import { TEAM_STATUS_LABEL } from "@/lib/format";

export type QueueTeam = {
  id: string;
  name: string;
  city: string | null;
  status: string;
  createdAt: Date | string;
};

function formatDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

type TeamQueueTableProps = {
  teams: QueueTeam[];
  title?: string;
  hint?: string;
  emptyText?: string;
};

export function TeamQueueTable({
  teams,
  title = "Antrian tim",
  hint = "Tim masuk ke bagan setelah admin melakukan acak.",
  emptyText = "Belum ada tim yang mendaftar.",
}: TeamQueueTableProps) {
  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-white/10 px-5 py-4">
        <h2 className="font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{hint}</p>
      </div>

      {teams.length === 0 ? (
        <p className="px-5 py-6 text-sm text-[var(--muted)]">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[var(--muted)]">
                <th className="px-4 py-3 font-medium">No</th>
                <th className="px-4 py-3 font-medium">Nama tim</th>
                <th className="px-4 py-3 font-medium">RW</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Tanggal daftar</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team, i) => (
                <tr
                  key={team.id}
                  className="border-b border-white/5 last:border-0"
                >
                  <td className="px-4 py-3 text-[var(--muted)]">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-white">
                    {team.name}
                  </td>
                  <td className="px-4 py-3 text-white">{team.city ?? "—"}</td>
                  <td className="px-4 py-3 text-white">
                    {TEAM_STATUS_LABEL[team.status] ?? team.status}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {formatDate(team.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
