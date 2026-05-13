"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";

const VERBS_A = [
  "Refactoring",
  "Compiling",
  "Testing",
  "Linting",
  "Benchmarking",
];

const VERBS_B = [
  "Sketching",
  "Profiling",
  "Debugging",
  "Tracing",
  "Reasoning",
];

const CAPTIONS: Record<number, string> = {
  0: "agent · running",
  1: "agent · running",
  2: "agent · forking…",
  3: "agent · agent-b · diverging",
};

export function ForkAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [stage, setStage] = useState(0);
  const [countA, setCountA] = useState(0);
  const [countB, setCountB] = useState(0);
  const [verbA, setVerbA] = useState(0);
  const [verbB, setVerbB] = useState(0);

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
    setCountA(0);
    setCountB(0);
    setVerbA(0);
    setVerbB(0);
    baseCountRef.current = 0;

    // Pre-fork: a single shared tick drives the agent's counter.
    const baseTick = setInterval(() => {
      baseCountRef.current += 1;
      setCountA(baseCountRef.current);
    }, 700);
    const verbATick = setInterval(
      () => setVerbA((i) => (i + 1) % VERBS_A.length),
      1200,
    );
    intervalsRef.current.push(baseTick, verbATick);

    timersRef.current = [
      setTimeout(() => setStage(1), 800),
      setTimeout(() => setStage(2), 3200), // fork moment
      setTimeout(() => {
        // Snapshot the current count, then split into two independent tickers.
        clearInterval(baseTick);
        intervalsRef.current = intervalsRef.current.filter(
          (i) => i !== baseTick,
        );
        const forkValue = baseCountRef.current;
        setCountB(forkValue);
        setStage(3);

        const tickA = setInterval(() => setCountA((c) => c + 1), 700);
        const tickB = setInterval(() => setCountB((c) => c + 1), 1100);
        const verbBTick = setInterval(
          () => setVerbB((i) => (i + 1) % VERBS_B.length),
          1700,
        );
        intervalsRef.current.push(tickA, tickB, verbBTick);
      }, 3800),
      setTimeout(() => play(), 12000),
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
          gap: "2rem",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 100,
        }}
      >
        <motion.div layout transition={{ duration: 0.5, ease: "easeInOut" }}>
          <Machine label="agent" pulse={stage === 2}>
            <VMBlock
              label="agent"
              count={countA}
              verb={VERBS_A[verbA]}
              forking={stage === 2}
            />
          </Machine>
        </motion.div>

        <AnimatePresence>
          {stage >= 3 && (
            <motion.div
              key="agent-b"
              layout
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <Machine label="agent-b">
                <VMBlock
                  label="agent-b"
                  count={countB}
                  verb={VERBS_B[verbB]}
                />
              </Machine>
            </motion.div>
          )}
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
          minWidth: 140,
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
