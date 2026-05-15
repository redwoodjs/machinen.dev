"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";

const LABELS = ["agent", "agent-b", "agent-c", "agent-d"];

const VERB_LISTS = [
  ["Refactoring", "Compiling", "Testing", "Linting", "Benchmarking"],
  ["Sketching", "Profiling", "Debugging", "Tracing", "Reasoning"],
  ["Tokenizing", "Diffing", "Embedding", "Searching", "Querying"],
  ["Reading", "Patching", "Building", "Verifying", "Reviewing"],
];

const TICK_INTERVALS = [700, 1100, 850, 1500];
const VERB_INTERVALS = [1200, 1700, 1400, 1900];

const N = 4;

const CAPTIONS: Record<number, string> = {
  0: "agent · running",
  1: "agent · running",
  2: "agent · forking…",
  3: "agent + 3 children · diverging",
};

export function ForkAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [stage, setStage] = useState(0);
  const [counts, setCounts] = useState<number[]>(() => Array(N).fill(0));
  const [verbs, setVerbs] = useState<number[]>(() => Array(N).fill(0));

  const baseCountRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);

  const cleanup = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    intervalsRef.current.forEach(clearInterval);
    timersRef.current = [];
    intervalsRef.current = [];
  }, []);

  const play = useCallback(() => {
    cleanup();
    setStage(0);
    setCounts(Array(N).fill(0));
    setVerbs(Array(N).fill(0));
    baseCountRef.current = 0;

    // Pre-fork: a single shared tick drives the source's counter.
    const baseTick = setInterval(() => {
      baseCountRef.current += 1;
      setCounts((prev) => {
        const next = [...prev];
        next[0] = baseCountRef.current;
        return next;
      });
    }, TICK_INTERVALS[0]);
    const baseVerbTick = setInterval(
      () =>
        setVerbs((prev) => {
          const next = [...prev];
          next[0] = (next[0] + 1) % VERB_LISTS[0].length;
          return next;
        }),
      VERB_INTERVALS[0],
    );
    intervalsRef.current.push(baseTick, baseVerbTick);

    timersRef.current = [
      setTimeout(() => setStage(1), 800),
      setTimeout(() => setStage(2), 3200), // fork moment
      setTimeout(() => {
        // Snapshot the source's count; all children inherit it, then tick independently.
        clearInterval(baseTick);
        intervalsRef.current = intervalsRef.current.filter(
          (i) => i !== baseTick,
        );
        const forkValue = baseCountRef.current;
        setCounts((prev) => prev.map((_, i) => (i === 0 ? prev[0] : forkValue)));
        setStage(3);

        for (let i = 0; i < N; i++) {
          const tick = setInterval(() => {
            setCounts((prev) => {
              const next = [...prev];
              next[i] = next[i] + 1;
              return next;
            });
          }, TICK_INTERVALS[i]);
          const verbTick = setInterval(() => {
            setVerbs((prev) => {
              const next = [...prev];
              next[i] = (next[i] + 1) % VERB_LISTS[i].length;
              return next;
            });
          }, VERB_INTERVALS[i]);
          intervalsRef.current.push(tick, verbTick);
        }
      }, 3800),
      setTimeout(() => play(), 13000),
    ];
  }, [cleanup]);

  useEffect(() => {
    if (inView) play();
    return cleanup;
  }, [inView, play, cleanup]);

  return (
    <div
      ref={ref}
      onClick={play}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          play();
        }
      }}
      title="Click to replay"
      aria-label="Replay fork animation"
      style={{
        margin: "2rem 0",
        padding: "0.5rem",
        fontFamily: "ui-monospace, monospace",
        color: "#444",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "1rem",
          justifyContent: "center",
          alignItems: "center",
          flexWrap: "wrap",
          minHeight: 100,
        }}
      >
        <motion.div layout transition={{ duration: 0.5, ease: "easeInOut" }}>
          <Machine label={LABELS[0]} pulse={stage === 2}>
            <VMBlock
              label={LABELS[0]}
              count={counts[0]}
              verb={VERB_LISTS[0][verbs[0]]}
              forking={stage === 2}
            />
          </Machine>
        </motion.div>

        <AnimatePresence>
          {stage >= 3 &&
            Array.from({ length: N - 1 }).map((_, idx) => {
              const i = idx + 1;
              // Each child starts at the source's position (one slot-width to
              // the left of where it'll end up, times its index) and slides
              // out to its final spot. Combined with the stagger delay, this
              // reads as the source "fanning" its children out into the row.
              const SLOT_WIDTH = 126; // minWidth 110 + gap 16
              return (
                <motion.div
                  key={LABELS[i]}
                  layout
                  initial={{
                    opacity: 0,
                    scale: 0.4,
                    x: -(idx + 1) * SLOT_WIDTH,
                    rotate: -6 + idx * 6,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    x: 0,
                    rotate: 0,
                  }}
                  exit={{ opacity: 0, scale: 0.4 }}
                  transition={{
                    duration: 0.7,
                    ease: [0.22, 1, 0.36, 1],
                    delay: idx * 0.18,
                  }}
                >
                  <Machine label={LABELS[i]}>
                    <VMBlock
                      label={LABELS[i]}
                      count={counts[i]}
                      verb={VERB_LISTS[i][verbs[i]]}
                    />
                  </Machine>
                </motion.div>
              );
            })}
        </AnimatePresence>
      </div>

      <div
        style={{
          textAlign: "center",
          marginTop: "0.75rem",
          fontSize: 12,
          color: "#666",
          minHeight: "1.2em",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {CAPTIONS[stage] || ""}
      </div>
    </div>
  );
}

function Machine({
  label,
  pulse,
  children,
}: {
  label: string;
  pulse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <motion.div
        animate={{ scale: pulse ? [1, 1.08, 1] : 1 }}
        transition={{ duration: 0.6 }}
        style={{
          border: "1.5px solid currentColor",
          borderRadius: 2,
          padding: 8,
          background: "white",
          minWidth: 110,
          color: "#444",
        }}
      >
        {children}
      </motion.div>
      <small style={{ marginTop: 6, color: "#888" }}>{label}</small>
    </div>
  );
}

function VMBlock({
  label,
  count,
  verb,
  forking,
}: {
  label: string;
  count: number;
  verb: string;
  forking?: boolean;
}) {
  return (
    <div style={{ textAlign: "center", lineHeight: 1.3 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: "#222" }}>
        {forking ? "forking…" : label}
      </div>
      <motion.div
        key={verb}
        initial={{ opacity: 0, y: 2 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ fontSize: 9, color: "#777", marginTop: 1 }}
      >
        ✻ {verb}… · {count}
      </motion.div>
    </div>
  );
}
