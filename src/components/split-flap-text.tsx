"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
} from "react";
import "./split-flap-text.css";

const DEFAULT_WORDS = ["LAUNCH READY", "SYNC ONLINE", "SIGNAL LIVE"];

const CHARSETS: Record<string, string> = {
  alpha: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  alphanumeric: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  numeric: "0123456789",
};

const TEAM_CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -.";

type Tile = {
  current: string;
  next: string;
  flipping: boolean;
  tick: number;
};

type CascadeOrder = "left" | "right" | "center" | "random";

export type SplitFlapTextProps = {
  words?: string[];
  text?: string;
  flipDuration?: number;
  stagger?: number;
  cycleDelay?: number;
  charset?: "alpha" | "alphanumeric" | "numeric" | string;
  flipsPerChar?: number;
  align?: "left" | "center" | "right";
  tileColor?: string;
  textColor?: string;
  tileRadius?: number | string;
  gap?: number | string;
  fontSize?: number | string;
  loop?: boolean;
  padTo?: number;
  intro?: boolean;
  order?: CascadeOrder;
  tileStyle?: "board" | "minimal";
  glare?: number;
  depth?: number;
  className?: string;
  style?: CSSProperties;
} & Omit<HTMLAttributes<HTMLDivElement>, "children">;

const toCssUnit = (value: number | string) =>
  typeof value === "number" ? `${value}px` : value;

const resolveCharset = (charset: string) => {
  if (CHARSETS[charset]) return CHARSETS[charset];
  return typeof charset === "string" && charset.length > 0
    ? charset
    : CHARSETS.alphanumeric;
};

const normalizePhrase = (
  phrase: string,
  width: number,
  align: "left" | "center" | "right" = "left"
) => {
  const safe = String(phrase ?? "").slice(0, width);
  if (align === "right") return safe.padStart(width, " ");
  if (align === "center") {
    return safe
      .padStart(safe.length + Math.floor((width - safe.length) / 2), " ")
      .padEnd(width, " ");
  }
  return safe.padEnd(width, " ");
};

const createTiles = (phrase: string): Tile[] =>
  phrase.split("").map((char) => ({
    current: char,
    next: char,
    flipping: false,
    tick: 0,
  }));

const sampleChar = (charset: string) =>
  charset.charAt(Math.floor(Math.random() * charset.length)) || " ";

const buildSequence = (target: string, flips: number, charset: string) => {
  const steps: string[] = [];
  for (let i = 0; i < flips; i += 1) {
    steps.push(sampleChar(charset));
  }
  steps.push(target);
  return steps;
};

const toGlyph = (char: string) => (char === " " ? "\u00a0" : char);

const shuffleIndices = (count: number) => {
  const list = Array.from({ length: count }, (_, index) => index);
  for (let i = count - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
};

const cascadeStep = (
  index: number,
  width: number,
  order: CascadeOrder,
  randomOrder: number[] | null
) => {
  if (order === "right") return width - 1 - index;
  if (order === "center") return Math.floor(Math.abs(index - (width - 1) / 2));
  if (order === "random" && randomOrder) return randomOrder[index];
  return index;
};

const clampUnit = (value: number) =>
  Math.min(1, Math.max(0, Number(value) || 0));

const round = (value: number) => Number(value.toFixed(3));

const getReducedMotion = () =>
  typeof window !== "undefined" &&
  Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

const usePrefersReducedMotion = () => {
  const [prefersReduced, setPrefersReduced] = useState(getReducedMotion);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setPrefersReduced(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersReduced;
};

export default function SplitFlapText({
  words = DEFAULT_WORDS,
  text,
  flipDuration = 0.08,
  stagger = 0.02,
  cycleDelay = 2400,
  charset = TEAM_CHARSET,
  flipsPerChar = 2,
  tileColor = "transparent",
  textColor = "#e8eefc",
  tileRadius = 0,
  gap = 0,
  fontSize = "0.875rem",
  loop = true,
  padTo = 12,
  align = "left",
  intro = true,
  glare = 0,
  depth = 0.35,
  order = "left",
  tileStyle = "minimal",
  className = "",
  style = {},
  ...props
}: SplitFlapTextProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const rafRef = useRef<number | null>(null);
  const shownRef = useRef<string | null>(null);
  const fromRef = useRef<string | null>(null);
  const indexRef = useRef(0);
  const phrasesRef = useRef<string[] | null>(null);

  const sourceWords =
    Array.isArray(words) && words.length > 0 ? words : DEFAULT_WORDS;
  const phrasesKey =
    typeof text === "string"
      ? text
      : sourceWords.map((word) => String(word ?? "")).join("\u001f");
  const phrases = useMemo(() => phrasesKey.split("\u001f"), [phrasesKey]);

  const width = useMemo(() => {
    const longest = phrases.reduce(
      (max, phrase) => Math.max(max, phrase.length),
      1
    );
    return Math.max(1, Math.ceil(Number(padTo) || 0), longest);
  }, [padTo, phrases]);

  const normalizedPhrases = useMemo(
    () => phrases.map((phrase) => normalizePhrase(phrase, width, align)),
    [phrases, width, align]
  );

  const timing = useMemo(
    () => ({
      flipMs: Math.max(40, (Number(flipDuration) || 0.1) * 1000),
      staggerMs: Math.max(0, (Number(stagger) || 0) * 1000),
      holdMs: Math.max(400, Number(cycleDelay) || 2400),
      flips: Math.max(0, Math.floor(Number(flipsPerChar) || 0)),
      glyphs: resolveCharset(charset),
      order,
    }),
    [flipDuration, stagger, cycleDelay, flipsPerChar, charset, order]
  );
  const timingRef = useRef(timing);

  const [tiles, setTiles] = useState(() =>
    createTiles(intro ? " ".repeat(width) : normalizedPhrases[0])
  );
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    timingRef.current = timing;
  }, [timing]);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    const stopFrame = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };

    const animateTo = (target: string) => {
      const {
        flipMs,
        staggerMs,
        flips,
        glyphs,
        order: cascade,
      } = timingRef.current;
      const from = normalizePhrase(shownRef.current ?? target, target.length);
      const randomOrder =
        cascade === "random" ? shuffleIndices(target.length) : null;

      stopFrame();
      shownRef.current = target;
      fromRef.current = null;

      const plans: {
        index: number;
        from: string;
        target: string;
        sequence: string[];
        start: number;
        step: number;
        done: boolean;
      }[] = [];

      if (!prefersReducedMotion) {
        for (let index = 0; index < target.length; index += 1) {
          if (from[index] === target[index]) continue;
          plans.push({
            index,
            from: from[index],
            target: target[index],
            sequence: buildSequence(target[index], flips, glyphs),
            start:
              cascadeStep(index, target.length, cascade, randomOrder) *
              staggerMs,
            step: -1,
            done: false,
          });
        }
      }

      if (!plans.length) {
        setTiles(createTiles(target));
        return 0;
      }

      fromRef.current = from;
      setTiles(createTiles(from));

      const totalDuration = plans.reduce(
        (max, plan) =>
          Math.max(max, plan.start + plan.sequence.length * flipMs),
        0
      );
      const startedAt = performance.now();

      const tick = (now: number) => {
        if (cancelled) return;

        const elapsed = now - startedAt;
        const updates: {
          index: number;
          current: string;
          next: string;
          done: boolean;
        }[] = [];
        let running = false;

        plans.forEach((plan) => {
          const localElapsed = elapsed - plan.start;

          if (localElapsed < 0) {
            running = true;
            return;
          }

          const step = Math.floor(localElapsed / flipMs);

          if (step < plan.sequence.length) {
            running = true;

            if (step !== plan.step) {
              plan.step = step;
              updates.push({
                index: plan.index,
                current: step === 0 ? plan.from : plan.sequence[step - 1],
                next: plan.sequence[step],
                done: false,
              });
            }
          } else if (!plan.done) {
            plan.done = true;
            updates.push({
              index: plan.index,
              current: plan.target,
              next: plan.target,
              done: true,
            });
          }
        });

        if (updates.length > 0) {
          setTiles((previous) => {
            const nextTiles = [...previous];
            updates.forEach((update) => {
              const tile = nextTiles[update.index];
              if (!tile) return;

              nextTiles[update.index] = {
                current: update.current,
                next: update.next,
                flipping: !update.done,
                tick: tile.tick + 1,
              };
            });
            return nextTiles;
          });
        }

        if (running) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
          fromRef.current = null;
        }
      };

      rafRef.current = requestAnimationFrame(tick);
      return totalDuration;
    };

    const show = (index: number) => {
      indexRef.current = index;
      setActiveIndex(index);
      return animateTo(normalizedPhrases[index]);
    };

    const scheduleNext = (delay: number) => {
      timer = window.setTimeout(() => {
        if (cancelled) return;

        if (document.hidden) {
          scheduleNext(timingRef.current.holdMs);
          return;
        }

        const nextIndex = indexRef.current + 1;
        if (nextIndex >= normalizedPhrases.length && !loop) return;

        const duration = show(nextIndex % normalizedPhrases.length);
        scheduleNext(timingRef.current.holdMs + duration);
      }, delay);
    };

    const samePhrases = phrasesRef.current === normalizedPhrases;
    phrasesRef.current = normalizedPhrases;

    if (shownRef.current === null) {
      shownRef.current = intro ? " ".repeat(width) : normalizedPhrases[0];
    }

    if (!samePhrases || indexRef.current >= normalizedPhrases.length) {
      indexRef.current = 0;
    } else if (fromRef.current !== null) {
      shownRef.current = fromRef.current;
    }

    let startDuration = 0;
    if (shownRef.current === normalizedPhrases[indexRef.current]) {
      stopFrame();
      fromRef.current = null;
      setActiveIndex(indexRef.current);
      setTiles(createTiles(shownRef.current));
    } else {
      startDuration = show(indexRef.current);
    }

    if (normalizedPhrases.length > 1 && typeof text !== "string") {
      scheduleNext(timingRef.current.holdMs + startDuration);
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stopFrame();
    };
  }, [normalizedPhrases, width, loop, intro, prefersReducedMotion, text]);

  const label = String(phrases[activeIndex] ?? phrases[0] ?? "").trim();
  const level = clampUnit(depth);
  const flat = Math.min(1, level * 2);
  const deep = Math.max(0, level - 0.5) * 2;
  const rootClass = ["split-flap-text", "split-flap-text--minimal", className]
    .filter(Boolean)
    .join(" ");
  const componentStyle = {
    "--split-flap-tile-color": tileColor,
    "--split-flap-text-color": textColor,
    "--split-flap-radius": toCssUnit(tileRadius),
    "--split-flap-gap": toCssUnit(gap),
    "--split-flap-font-size": toCssUnit(fontSize),
    "--split-flap-flip-duration": `${Math.max(0.04, Number(flipDuration) || 0.1)}s`,
    "--split-flap-front-from": round(1 + 0.08 * flat),
    "--split-flap-front-to": round(1 - 0.48 * flat - 0.3 * deep),
    "--split-flap-back-from": round(1 - 0.42 * flat - 0.3 * deep),
    "--split-flap-hinge": `calc(1px + ${round(deep * 0.05)}em)`,
    "--split-flap-hinge-shade": round(0.25 + 0.39 * flat + 0.21 * deep),
    "--split-flap-drop": round(0.28 * flat + 0.2 * deep),
    "--split-flap-lift": round(0.4 + 0.6 * flat + 0.7 * deep),
    "--split-flap-cast": round(deep * 0.62),
    "--split-flap-edge": `${round(deep * 0.035)}em`,
    "--split-flap-split": "0px",
    "--split-flap-glare": 0,
    ...style,
  } as CSSProperties;

  void tileStyle;
  void glare;

  return (
    <div className={rootClass} style={componentStyle} {...props}>
      <span className="split-flap-text__sr">{label}</span>
      {tiles.map((tile, index) => (
        <span
          className={`split-flap-text__tile${tile.flipping ? " is-flipping" : ""}`}
          aria-hidden="true"
          key={`${index}-${tiles.length}`}
        >
          <span
            className="split-flap-text__half split-flap-text__half--top"
            key={`top-${tile.tick}`}
          >
            <span className="split-flap-text__char">
              {toGlyph(tile.flipping ? tile.next : tile.current)}
            </span>
          </span>
          <span
            className="split-flap-text__half split-flap-text__half--bottom"
            key={`bottom-${tile.tick}`}
          >
            <span className="split-flap-text__char">
              {toGlyph(tile.current)}
            </span>
          </span>

          {tile.flipping && (
            <>
              <span
                className="split-flap-text__flap split-flap-text__flap--front"
                key={`front-${index}-${tile.tick}`}
              >
                <span className="split-flap-text__char">
                  {toGlyph(tile.current)}
                </span>
              </span>
              <span
                className="split-flap-text__flap split-flap-text__flap--back"
                key={`back-${index}-${tile.tick}`}
              >
                <span className="split-flap-text__char">
                  {toGlyph(tile.next)}
                </span>
              </span>
            </>
          )}
        </span>
      ))}
    </div>
  );
}
