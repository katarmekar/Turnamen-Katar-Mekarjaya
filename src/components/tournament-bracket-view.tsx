import {
  BracketFilled,
  BracketSkeleton,
} from "@/components/bracket-skeleton";
import { GroupResultsMatrix } from "@/components/group-results-matrix";
import { normalizePreviewBracketSize } from "@/lib/bracket-size";
import { COMPETITION_FORMAT_LABEL } from "@/lib/format";
import {
  buildGroupMatrices,
  isLeagueFormat,
  pickQualifiers,
} from "@/lib/league";
import type { TournamentForBracket } from "@/lib/tournament-bracket";

type TournamentBracketViewProps = {
  tournament: TournamentForBracket | null;
  /** Tampilkan judul & meta di atas konten (default true) */
  showHeading?: boolean;
  /** Tim fokus (manajer) — matriks grup default ke grup tim ini. */
  focusTeamId?: string | null;
};

const KNOCKOUT_ROUND_BASE = 10;

/** Estimasi ukuran bagan KO dari setting grup — minimum 4 (SF→final). */
function expectedKnockoutSize(
  groupCount: number | null | undefined,
  qualifyPerGroup: number | null | undefined
) {
  const n = (groupCount ?? 0) * (qualifyPerGroup ?? 0);
  if (n < 2) return 4;
  let p = 2;
  while (p < n) p *= 2;
  return Math.max(4, p);
}

/** Label babak 1 dari klasemen sementara (preview sebelum fase gugur). */
function buildQualifierPreviewLabels(
  matrices: ReturnType<typeof buildGroupMatrices>,
  qualifyPerGroup: number,
  bracketSize: number
): string[] {
  const qualifiers = pickQualifiers(matrices, qualifyPerGroup);
  const labels = qualifiers.map(
    (q) => `${q.name} (G${String.fromCharCode(65 + q.groupIndex)}#${q.rank})`
  );
  while (labels.length < bracketSize) labels.push("—");
  return labels.slice(0, bracketSize);
}

export function TournamentBracketView({
  tournament,
  showHeading = true,
  focusTeamId,
}: TournamentBracketViewProps) {
  const isRr = isLeagueFormat(tournament?.competitionFormat);
  const hasSchedule = tournament != null && tournament.matches.length > 0;
  const confirmedCount =
    tournament?.teams.filter((t) => t.status === "confirmed").length ?? 0;

  const groupMatrices = tournament
    ? buildGroupMatrices(tournament.matches, tournament.bracketSlots, {
        pointsWin: tournament.pointsWin,
        pointsDraw: tournament.pointsDraw,
        pointsLoss: tournament.pointsLoss,
      })
    : [];

  const knockoutMatches = tournament
    ? tournament.matches.filter(
        (m) => m.groupIndex == null && m.round >= KNOCKOUT_ROUND_BASE
      )
    : [];
  const knockoutSlots = tournament
    ? tournament.bracketSlots.filter(
        (s) => s.groupIndex == null && s.round >= KNOCKOUT_ROUND_BASE
      )
    : [];
  const hasKnockout = knockoutMatches.length > 0 && knockoutSlots.length > 0;
  const groupMatches = tournament
    ? tournament.matches.filter((m) => m.groupIndex != null)
    : [];
  const pendingGroupMatches = groupMatches.filter((m) => !m.resultType).length;
  const groupsComplete =
    groupMatches.length > 0 && pendingGroupMatches === 0;
  const expectedKo = expectedKnockoutSize(
    tournament?.groupCount,
    tournament?.qualifyPerGroup
  );
  const koSize = normalizePreviewBracketSize(
    tournament?.bracketSize && tournament.bracketSize > 0
      ? tournament.bracketSize
      : expectedKo
  );
  // Nama tim baru masuk slot KO setelah semua pertandingan grup selesai
  // (dan sebelum/ sesudah admin memulai fase gugur).
  const previewLabels =
    !hasKnockout && groupsComplete
      ? buildQualifierPreviewLabels(
          groupMatrices,
          tournament?.qualifyPerGroup ?? 0,
          koSize
        )
      : undefined;

  const groupMeta =
    isRr && tournament?.groupCount
      ? ` · ${tournament.groupCount} grup × maks ${tournament.maxTeamsPerGroup ?? "—"} · lolos ${tournament.qualifyPerGroup ?? "—"}/grup`
      : "";

  return (
    <div>
      {showHeading && (
        <>
          <p className="text-sm uppercase tracking-[0.25em] text-[var(--accent)]">
            {isRr ? "Sistem liga" : "Sistem gugur"}
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-wide text-white sm:text-4xl">
            {tournament?.name ?? "Bagan"}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {tournament
              ? `Status ${tournament.status} · ${
                  COMPETITION_FORMAT_LABEL[tournament.competitionFormat] ??
                  tournament.competitionFormat
                }${groupMeta} · kapasitas ${tournament.maxTeams}${
                  hasSchedule
                    ? isRr
                      ? ` · ${tournament.matches.length} pertandingan`
                      : ` · bagan ${tournament.bracketSize ?? "—"}`
                    : " · belum diacak"
                } · ${tournament.teams.length} tim antri · ${confirmedCount} siap acak`
              : "Belum ada turnamen aktif."}
          </p>
        </>
      )}

      {!tournament ? (
        <div className="panel mt-6 p-8">
          <p className="text-sm text-[var(--muted)]">Belum ada bagan aktif.</p>
        </div>
      ) : (
        <div className={showHeading ? "mt-6 space-y-8" : "space-y-8"}>
          {isRr ? (
            <>
              {hasSchedule ? (
                <div className="panel p-6">
                  <h3 className="font-semibold text-white">Hasil fase grup</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Matriks skor dan klasemen per grup. Tim baru masuk bagan
                    knockout setelah seluruh pertandingan grup selesai.
                  </p>
                  <div className="mt-4">
                    <GroupResultsMatrix
                      groups={groupMatrices}
                      pointsWin={tournament.pointsWin}
                      pointsDraw={tournament.pointsDraw}
                      pointsLoss={tournament.pointsLoss}
                      focusTeamId={focusTeamId}
                    />
                  </div>
                </div>
              ) : (
                <div className="panel p-6">
                  <p className="text-sm text-[var(--muted)]">
                    Format{" "}
                    {COMPETITION_FORMAT_LABEL[tournament.competitionFormat]}.
                    {tournament.groupCount
                      ? ` ${tournament.groupCount} grup, maks ${tournament.maxTeamsPerGroup} tim/grup, ${tournament.qualifyPerGroup} lolos/grup.`
                      : " Atur grup di Edit turnamen."}{" "}
                    Jadwal dibuat setelah admin menekan{" "}
                    <strong className="text-white">Acak tim</strong>.
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div className="panel p-4">
                  <h3 className="font-semibold text-white">
                    Bagan knockout
                    {koSize <= 4
                      ? " (semifinal → final)"
                      : koSize <= 8
                        ? " (perempat → final)"
                        : ""}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {hasKnockout
                      ? `Tim lolos dari grup · bagan ${koSize}`
                      : groupsComplete
                        ? `Fase grup selesai · ${tournament.qualifyPerGroup ?? "—"} lolos/grup · kerangka ${koSize}. Urutan final diacak saat admin memulai fase gugur.`
                        : hasSchedule
                          ? `Menunggu fase grup selesai (${pendingGroupMatches} pertandingan belum main). Slot perempat/semifinal tetap kosong.`
                          : `Kerangka bagan ${koSize} — terisi setelah seluruh pertandingan grup selesai.`}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  {hasKnockout ? (
                    <BracketFilled
                      slots={knockoutSlots}
                      bracketSize={
                        tournament.bracketSize && tournament.bracketSize > 0
                          ? tournament.bracketSize
                          : koSize
                      }
                      matches={knockoutMatches.map((m) => ({
                        slotAId: m.slotAId,
                        slotBId: m.slotBId,
                        winnerTeamId: m.winnerTeamId,
                        resultType: m.resultType,
                      }))}
                    />
                  ) : (
                    <BracketSkeleton
                      maxTeams={koSize}
                      r1Labels={previewLabels}
                    />
                  )}
                </div>
              </div>

              {hasSchedule && (
                <div className="panel p-6">
                  <h3 className="font-semibold text-white">
                    Daftar pertandingan
                  </h3>
                  <ul className="mt-4 space-y-2 text-sm">
                    {tournament.matches.map((m) => (
                      <li
                        key={m.id}
                        className="rounded-lg border border-[var(--border)] px-3 py-2 text-[var(--muted)]"
                      >
                        <span className="text-white">
                          {m.slotA.team?.name ?? "—"} vs{" "}
                          {m.slotB.team?.name ?? "—"}
                        </span>
                        {m.notes ? ` · ${m.notes}` : ""}
                        {m.resultType
                          ? m.scoreA != null && m.scoreB != null
                            ? ` · ${m.scoreA}-${m.scoreB}`
                            : ` · ${m.resultType}`
                          : " · Belum main"}
                        {m.winnerTeam
                          ? ` · ${m.winnerTeam.name}`
                          : m.resultType === "score" && m.scoreA === m.scoreB
                            ? " · Seri"
                            : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              {!hasSchedule && tournament.teams.length > 0 && (
                <div className="panel space-y-2 p-4">
                  <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
                    Tim di antrian bagan ({confirmedCount} siap acak)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {tournament.teams.map((t) => (
                      <span
                        key={t.id}
                        className={`bracket-team-chip ${
                          t.status === "confirmed" ? "is-ready" : "is-wait"
                        }`}
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-[var(--muted)]">
                    Nama masuk ke slot bagan setelah admin menekan Acak.
                  </p>
                </div>
              )}
              <div className="mt-2 overflow-x-auto">
                {hasSchedule && tournament.bracketSlots.length > 0 ? (
                  <BracketFilled
                    slots={tournament.bracketSlots}
                    bracketSize={
                      tournament.bracketSize && tournament.bracketSize > 0
                        ? tournament.bracketSize
                        : tournament.maxTeams
                    }
                    matches={tournament.matches.map((m) => ({
                      slotAId: m.slotAId,
                      slotBId: m.slotBId,
                      winnerTeamId: m.winnerTeamId,
                      resultType: m.resultType,
                    }))}
                  />
                ) : (
                  <BracketSkeleton maxTeams={tournament.maxTeams} />
                )}
              </div>
            </div>
          )}

          {!isRr &&
            hasSchedule &&
            tournament.matches.some((m) => m.resultType) && (
              <div className="panel p-6">
                <h3 className="font-semibold text-white">
                  Hasil pertandingan
                </h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {tournament.matches
                    .filter((m) => m.resultType)
                    .map((m) => (
                      <li key={m.id} className="text-[var(--muted)]">
                        R{m.round}: {m.slotA.team?.name ?? "BYE"} vs{" "}
                        {m.slotB.team?.name ?? "BYE"} →{" "}
                        <span className="text-white">
                          {m.winnerTeam?.name ??
                            (m.scoreA === m.scoreB ? "Seri" : "—")}
                        </span>
                        {m.scoreA != null && m.scoreB != null
                          ? ` (${m.scoreA}-${m.scoreB})`
                          : ` (${m.resultType})`}
                      </li>
                    ))}
                </ul>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
