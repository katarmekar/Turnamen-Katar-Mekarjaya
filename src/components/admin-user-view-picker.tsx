"use client";

import { useRouter } from "next/navigation";

export type AdminUserViewTeamOption = {
  id: string;
  name: string;
  city: string | null;
  status: string;
};

export function AdminUserViewPicker({
  teams,
  selectedTeamId,
  basePath = "/admin/tampilan-user",
}: {
  teams: AdminUserViewTeamOption[];
  selectedTeamId: string | null;
  basePath?: string;
}) {
  const router = useRouter();

  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm sm:max-w-md">
      <span className="text-[var(--muted)]">Pilih tim</span>
      <select
        className="input"
        value={selectedTeamId ?? ""}
        onChange={(e) => {
          const id = e.target.value;
          router.push(id ? `${basePath}?teamId=${id}` : basePath);
        }}
      >
        <option value="">— Pilih tim —</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.city?.trim() ? ` · ${t.city.trim()}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
