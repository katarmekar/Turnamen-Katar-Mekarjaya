export type SlotData = {
  id?: string;
  round: number;
  side: string;
  position: number;
  isBye: boolean;
  team: { id?: string; name: string } | null;
};

export type MatchOutcomeData = {
  slotAId: string;
  slotBId: string;
  winnerTeamId: string | null;
  resultType: string | null;
};

export type SlotTone = "empty" | "bye" | "filled" | "winner" | "loser";

type BracketSkeletonProps = {
  maxTeams: number;
  /** Label override untuk slot babak 1 (animasi acak) */
  r1Labels?: string[];
  shuffling?: boolean;
};

type BracketFilledProps = {
  slots: SlotData[];
  bracketSize?: number | null;
  r1Labels?: string[];
  shuffling?: boolean;
  matches?: MatchOutcomeData[];
};

export function normalizeBracketSize(n: number) {
  if (n <= 8) return 8;
  if (n <= 16) return 16;
  return 32;
}

function roundLabel(size: number, round: number, totalRounds: number) {
  const remaining = size / 2 ** (round - 1);
  if (round === totalRounds) return null;
  if (remaining === 4) return "SEMIFINAL";
  return null;
}

function slotText(slot: SlotData | undefined, override?: string) {
  if (override !== undefined) return override;
  if (!slot) return "—";
  if (slot.isBye) return "BYE";
  return slot.team?.name ?? "—";
}

/** Tentukan warna slot: terisi/pemenang emas, kalah gelap. */
export function resolveSlotTones(
  slots: SlotData[],
  matches: MatchOutcomeData[] = []
): Map<string, SlotTone> {
  const tones = new Map<string, SlotTone>();
  const decided = new Map<
    string,
    { winnerTeamId: string | null; resultType: string | null }
  >();

  for (const m of matches) {
    if (!m.resultType) continue;
    decided.set(m.slotAId, {
      winnerTeamId: m.winnerTeamId,
      resultType: m.resultType,
    });
    decided.set(m.slotBId, {
      winnerTeamId: m.winnerTeamId,
      resultType: m.resultType,
    });
  }

  for (const slot of slots) {
    const key = slot.id ?? `${slot.round}-${slot.side}-${slot.position}`;
    if (slot.isBye || (!slot.team && !slot.isBye)) {
      if (slot.isBye) {
        tones.set(key, "bye");
        continue;
      }
      if (!slot.team) {
        tones.set(key, "empty");
        continue;
      }
    }

    if (!slot.team) {
      tones.set(key, "empty");
      continue;
    }

    const decision = slot.id ? decided.get(slot.id) : undefined;
    if (decision?.winnerTeamId) {
      const teamId = slot.team.id;
      if (teamId && teamId === decision.winnerTeamId) {
        tones.set(key, "winner");
      } else {
        tones.set(key, "loser");
      }
      continue;
    }

    // Ada hasil tapi tanpa pemenang (jarang di knockout) → tetap filled
    tones.set(key, "filled");
  }

  return tones;
}

function BracketSlot({
  label,
  flash,
  tone = "empty",
}: {
  label: string;
  flash?: boolean;
  tone?: SlotTone;
}) {
  const empty = label === "—" || label === "";
  const toneClass = flash
    ? "is-shuffling"
    : empty
      ? "is-empty"
      : `is-${tone}`;

  return (
    <div
      className={`pro-bracket-slot ${toneClass}`}
      title={label}
      data-tone={flash ? "shuffling" : empty ? "empty" : tone}
    >
      <span key={flash ? label : undefined}>{label || "—"}</span>
    </div>
  );
}

function MatchColumn({
  slots,
  side,
  round,
  size,
  totalRounds,
  mirror,
  r1Labels,
  shuffling,
  tones,
}: {
  slots: (SlotData | undefined)[];
  side: "left" | "right";
  round: number;
  size: number;
  totalRounds: number;
  mirror?: boolean;
  r1Labels?: string[];
  shuffling?: boolean;
  tones: Map<string, SlotTone>;
}) {
  const pairs: {
    a: SlotData | undefined;
    b: SlotData | undefined;
    ai: number;
    bi: number;
  }[] = [];
  for (let i = 0; i < slots.length; i += 2) {
    pairs.push({ a: slots[i], b: slots[i + 1], ai: i, bi: i + 1 });
  }

  const label = roundLabel(size, round, totalRounds);
  const half = size / 2;
  const sideOffset = side === "left" ? 0 : half;

  function toneFor(slot: SlotData | undefined, override?: string): SlotTone {
    if (override !== undefined) {
      if (override === "—" || override === "" || override === "BYE") {
        return override === "BYE" ? "bye" : "empty";
      }
      return "filled";
    }
    if (!slot) return "empty";
    const key = slot.id ?? `${slot.round}-${slot.side}-${slot.position}`;
    return tones.get(key) ?? (slot.team ? "filled" : slot.isBye ? "bye" : "empty");
  }

  return (
    <div
      className={`pro-bracket-col${mirror ? " is-mirror" : ""}`}
      data-round={round}
      data-side={side}
    >
      {pairs.map((pair, idx) => {
        const aOverride =
          round === 1 && r1Labels
            ? r1Labels[sideOffset + pair.ai]
            : undefined;
        const bOverride =
          round === 1 && r1Labels
            ? r1Labels[sideOffset + pair.bi]
            : undefined;
        return (
          <div key={`${side}-r${round}-p${idx}`} className="pro-bracket-match">
            <div className="pro-bracket-pair">
              <BracketSlot
                label={slotText(pair.a, aOverride)}
                flash={shuffling && round === 1}
                tone={toneFor(pair.a, aOverride)}
              />
              <BracketSlot
                label={slotText(pair.b, bOverride)}
                flash={shuffling && round === 1}
                tone={toneFor(pair.b, bOverride)}
              />
            </div>
            {label && pairs.length <= 4 && (
              <span className="pro-bracket-round-label">{label}</span>
            )}
            <div className="pro-bracket-connector" aria-hidden />
          </div>
        );
      })}
    </div>
  );
}

function ChampionCenter({
  finalLeft,
  finalRight,
  tones,
}: {
  finalLeft?: SlotData;
  finalRight?: SlotData;
  tones: Map<string, SlotTone>;
}) {
  function toneFor(slot?: SlotData): SlotTone {
    if (!slot) return "empty";
    const key = slot.id ?? `${slot.round}-${slot.side}-${slot.position}`;
    return tones.get(key) ?? (slot.team ? "filled" : "empty");
  }

  return (
    <div className="pro-bracket-center">
      <div className="pro-bracket-trophy" aria-hidden>
        <svg viewBox="0 0 64 72" className="pro-bracket-trophy-svg">
          <defs>
            <linearGradient id="trophyGold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffe566" />
              <stop offset="45%" stopColor="#f5c518" />
              <stop offset="100%" stopColor="#c9920a" />
            </linearGradient>
          </defs>
          <path
            fill="url(#trophyGold)"
            d="M18 8h28v6c0 10-6 18-14 20v6h8v4H24v-4h8v-6C24 32 18 24 18 14V8z"
          />
          <path
            fill="url(#trophyGold)"
            d="M18 10c-6 1-10 6-10 12 0 5 3 9 8 11V10zm28 0v23c5-2 8-6 8-11 0-6-4-11-10-12z"
            opacity="0.92"
          />
          <rect
            x="22"
            y="48"
            width="20"
            height="4"
            rx="1"
            fill="url(#trophyGold)"
          />
          <path fill="url(#trophyGold)" d="M16 56h32l-3 10H19l-3-10z" />
          <circle cx="48" cy="14" r="2.2" fill="#fff8d6" opacity="0.9" />
          <circle cx="14" cy="20" r="1.4" fill="#fff8d6" opacity="0.75" />
        </svg>
      </div>

      <svg
        className="pro-bracket-champion-text"
        viewBox="0 0 280 56"
        aria-hidden
      >
        <defs>
          <path id="champArc" d="M20,48 Q140,8 260,48" fill="none" />
        </defs>
        <text
          fill="#ffffff"
          fontSize="28"
          fontWeight="800"
          letterSpacing="6"
          fontFamily="var(--font-display), Impact, sans-serif"
        >
          <textPath href="#champArc" startOffset="50%" textAnchor="middle">
            CHAMPION
          </textPath>
        </text>
      </svg>

      <div className="pro-bracket-finalists">
        <BracketSlot label={slotText(finalLeft)} tone={toneFor(finalLeft)} />
        <BracketSlot label={slotText(finalRight)} tone={toneFor(finalRight)} />
      </div>
    </div>
  );
}

export function buildEmptySlots(size: number): SlotData[] {
  const totalRounds = Math.log2(size);
  const slots: SlotData[] = [];
  for (let round = 1; round <= totalRounds; round++) {
    const slotsThisRound = size / 2 ** (round - 1);
    const perSide = slotsThisRound / 2;
    for (const side of ["left", "right"] as const) {
      for (let position = 0; position < perSide; position++) {
        slots.push({
          round,
          side,
          position,
          isBye: false,
          team: null,
        });
      }
    }
  }
  return slots;
}

export function ProBracketView({
  slots,
  size,
  r1Labels,
  shuffling,
  matches = [],
}: {
  slots: SlotData[];
  size: number;
  r1Labels?: string[];
  shuffling?: boolean;
  matches?: MatchOutcomeData[];
}) {
  const totalRounds = Math.log2(size);
  const sideRounds = totalRounds - 1;
  const tones = resolveSlotTones(slots, matches);

  const byRoundSide = (round: number, side: "left" | "right") =>
    slots
      .filter((s) => s.round === round && s.side === side)
      .sort((a, b) => a.position - b.position);

  const finalLeft = byRoundSide(totalRounds, "left")[0];
  const finalRight = byRoundSide(totalRounds, "right")[0];

  return (
    <div
      className={`pro-bracket${shuffling ? " is-shuffling" : ""}`}
      data-size={size}
    >
      <div className="pro-bracket-scroll">
        <div className="pro-bracket-board">
          {Array.from({ length: sideRounds }, (_, i) => {
            const round = i + 1;
            return (
              <MatchColumn
                key={`L-${round}`}
                slots={byRoundSide(round, "left")}
                side="left"
                round={round}
                size={size}
                totalRounds={totalRounds}
                r1Labels={r1Labels}
                shuffling={shuffling}
                tones={tones}
              />
            );
          })}

          <ChampionCenter
            finalLeft={finalLeft}
            finalRight={finalRight}
            tones={tones}
          />

          {Array.from({ length: sideRounds }, (_, i) => {
            const round = sideRounds - i;
            return (
              <MatchColumn
                key={`R-${round}`}
                slots={byRoundSide(round, "right")}
                side="right"
                round={round}
                size={size}
                totalRounds={totalRounds}
                mirror
                r1Labels={r1Labels}
                shuffling={shuffling}
                tones={tones}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Kerangka bagan kosong (sistem gugur) — gaya pro simetris.
 */
export function BracketSkeleton({
  maxTeams,
  r1Labels,
  shuffling,
}: BracketSkeletonProps) {
  const size = normalizeBracketSize(maxTeams);
  return (
    <ProBracketView
      slots={buildEmptySlots(size)}
      size={size}
      r1Labels={r1Labels}
      shuffling={shuffling}
    />
  );
}

/**
 * Bagan terisi dari slot DB.
 */
export function BracketFilled({
  slots,
  bracketSize,
  r1Labels,
  shuffling,
  matches,
}: BracketFilledProps) {
  const inferred =
    bracketSize ?? (slots.filter((s) => s.round === 1).length || 16);
  const size = normalizeBracketSize(inferred);
  return (
    <ProBracketView
      slots={slots}
      size={size}
      r1Labels={r1Labels}
      shuffling={shuffling}
      matches={matches}
    />
  );
}
