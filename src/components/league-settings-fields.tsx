"use client";

import { useState } from "react";

type LeagueSettingsFieldsProps = {
  defaultFormat?: string;
  defaultGroupCount?: number | null;
  defaultMaxTeamsPerGroup?: number | null;
  defaultQualifyPerGroup?: number | null;
  maxTeams?: number;
};

export function LeagueSettingsFields({
  defaultFormat = "knockout",
  defaultGroupCount,
  defaultMaxTeamsPerGroup,
  defaultQualifyPerGroup,
  maxTeams = 16,
}: LeagueSettingsFieldsProps) {
  const [format, setFormat] = useState(defaultFormat);
  const isLeague = format !== "knockout";

  const suggestedGroups = maxTeams >= 16 ? 4 : 2;
  const suggestedPerGroup = Math.max(2, Math.ceil(maxTeams / suggestedGroups));

  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Sistem kompetisi</span>
        <select
          name="competition_format"
          className="input"
          value={format}
          onChange={(e) => setFormat(e.target.value)}
        >
          <option value="knockout">Sistem gugur (knockout)</option>
          <option value="single_round_robin">
            Sistem liga — fase grup (bertemu 1×)
          </option>
          <option value="double_round_robin">
            Sistem liga — fase grup (bertemu 2×)
          </option>
        </select>
      </label>

      {isLeague && (
        <div className="sm:col-span-2 grid gap-3 sm:grid-cols-3 rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <p className="sm:col-span-3 text-xs text-[var(--muted)]">
            Fase grup: atur jumlah grup, kapasitas per grup (boleh kurang dari
            maks.), dan berapa tim yang lolos ke fase gugur dari tiap grup. Jika
            jumlah tim ganjil, salah satu grup boleh berukuran ganjil. Matriks
            hasil &amp; klasemen tampil di menu Bagan.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Jumlah grup</span>
            <input
              name="group_count"
              type="number"
              min={1}
              max={16}
              required
              className="input"
              defaultValue={defaultGroupCount ?? suggestedGroups}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Maks. tim per grup</span>
            <input
              name="max_teams_per_group"
              type="number"
              min={2}
              max={16}
              required
              className="input"
              defaultValue={defaultMaxTeamsPerGroup ?? suggestedPerGroup}
            />
            <span className="text-[11px] text-[var(--muted)]">
              Grup boleh terisi lebih sedikit.
            </span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Lolos per grup</span>
            <input
              name="qualify_per_group"
              type="number"
              min={1}
              max={8}
              required
              className="input"
              defaultValue={defaultQualifyPerGroup ?? 1}
            />
            <span className="text-[11px] text-[var(--muted)]">
              Ke fase gugur (SF/final).
            </span>
          </label>
        </div>
      )}
    </>
  );
}
