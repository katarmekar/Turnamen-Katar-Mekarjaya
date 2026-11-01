"use client";

import { useEffect, useId, useState } from "react";

type LeagueSettingsFieldsProps = {
  defaultFormat?: string;
  defaultGroupCount?: number | null;
  defaultMaxTeamsPerGroup?: number | null;
  defaultQualifyPerGroup?: number | null;
  defaultPointsWin?: number;
  defaultPointsDraw?: number;
  defaultPointsLoss?: number;
  maxTeams?: number;
};

function suggestGroups(capacity: number) {
  return capacity >= 16 ? 4 : 2;
}

function suggestPerGroup(capacity: number, groups: number) {
  return Math.max(2, Math.ceil(capacity / Math.max(1, groups)));
}

export function LeagueSettingsFields({
  defaultFormat = "knockout",
  defaultGroupCount,
  defaultMaxTeamsPerGroup,
  defaultQualifyPerGroup,
  defaultPointsWin = 2,
  defaultPointsDraw = 1,
  defaultPointsLoss = 0,
  maxTeams: initialMaxTeams = 16,
}: LeagueSettingsFieldsProps) {
  const rootId = useId();
  const [format, setFormat] = useState(defaultFormat);
  const [capacity, setCapacity] = useState(initialMaxTeams);
  const isLeague = format !== "knockout";

  const suggestedGroups = suggestGroups(capacity);
  const [groupCount, setGroupCount] = useState(
    defaultGroupCount && defaultGroupCount > 0
      ? defaultGroupCount
      : suggestedGroups
  );
  const [maxPerGroup, setMaxPerGroup] = useState(
    defaultMaxTeamsPerGroup && defaultMaxTeamsPerGroup > 0
      ? defaultMaxTeamsPerGroup
      : suggestPerGroup(capacity, groupCount)
  );
  const [qualifyPerGroup, setQualifyPerGroup] = useState(
    defaultQualifyPerGroup && defaultQualifyPerGroup > 0
      ? defaultQualifyPerGroup
      : 1
  );

  // Ikuti perubahan input kapasitas di form yang sama.
  useEffect(() => {
    const root = document.getElementById(rootId);
    const form = root?.closest("form");
    const maxInput = form?.querySelector<HTMLInputElement>(
      'input[name="max_teams"]'
    );
    if (!maxInput) return;

    const sync = () => {
      const next = Number(maxInput.value);
      if (Number.isFinite(next) && next >= 2) setCapacity(next);
    };
    sync();
    maxInput.addEventListener("input", sync);
    maxInput.addEventListener("change", sync);
    return () => {
      maxInput.removeEventListener("input", sync);
      maxInput.removeEventListener("change", sync);
    };
  }, [rootId]);

  // Pastikan kapasitas grup selalu cukup menampung kapasitas turnamen.
  useEffect(() => {
    if (!isLeague) return;
    setGroupCount((g) => {
      const groups = g > 0 ? g : suggestGroups(capacity);
      setMaxPerGroup((per) => {
        const need = suggestPerGroup(capacity, groups);
        if (!per || per * groups < capacity) return need;
        return per;
      });
      return groups;
    });
  }, [capacity, isLeague]);

  // Lolos per grup tidak boleh melebihi maks. tim per grup.
  useEffect(() => {
    if (!isLeague) return;
    setQualifyPerGroup((q) => {
      const next = q > 0 ? q : 1;
      return Math.min(next, Math.max(1, maxPerGroup));
    });
  }, [maxPerGroup, isLeague]);

  const capacityOk = groupCount * maxPerGroup >= capacity;

  return (
    <div id={rootId} className="contents">
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
              value={groupCount}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isFinite(next)) return;
                setGroupCount(next);
                const need = suggestPerGroup(capacity, next);
                setMaxPerGroup((per) =>
                  !per || per * next < capacity ? need : per
                );
              }}
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
              value={maxPerGroup}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isFinite(next)) setMaxPerGroup(next);
              }}
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
              value={qualifyPerGroup}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isFinite(next)) setQualifyPerGroup(next);
              }}
            />
            <span className="text-[11px] text-[var(--muted)]">
              Ke fase gugur (SF/final).
            </span>
          </label>
          {!capacityOk && (
            <p className="sm:col-span-3 text-xs text-amber-300">
              Kapasitas grup sekarang {groupCount}×{maxPerGroup}=
              {groupCount * maxPerGroup}, lebih kecil dari kapasitas turnamen (
              {capacity}). Naikkan jumlah grup atau maks. tim per grup sebelum
              menyimpan.
            </p>
          )}
          <p className="sm:col-span-3 mt-1 text-xs font-medium text-white">
            Poin klasemen
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Poin menang</span>
            <input
              name="points_win"
              type="number"
              min={0}
              max={20}
              required
              className="input"
              defaultValue={defaultPointsWin}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Poin seri</span>
            <input
              name="points_draw"
              type="number"
              min={0}
              max={20}
              required
              className="input"
              defaultValue={defaultPointsDraw}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Poin kalah</span>
            <input
              name="points_loss"
              type="number"
              min={0}
              max={20}
              required
              className="input"
              defaultValue={defaultPointsLoss}
            />
          </label>
        </div>
      )}
    </div>
  );
}
