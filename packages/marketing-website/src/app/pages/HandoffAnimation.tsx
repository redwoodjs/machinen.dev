"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useInView } from "motion/react";

const CAPTIONS: Record<number, string> = {
  0: "agent · running on laptop",
  1: "agent · running on laptop",
  2: "agent · snapshotting…",
  3: "agent · shipping → desktop",
  4: "agent · running on desktop",
  5: "agent · snapshotting…",
  6: "agent · shipping → laptop",
  7: "agent · running on laptop",
};

const VERBS = [
  "Nebulizing",
  "Pondering",
  "Crystallizing",
  "Synthesizing",
  "Brewing",
  "Conjuring",
  "Untangling",
  "Percolating",
  "Marinating",
  "Distilling",
  "Cogitating",
  "Unfurling",
];

export function HandoffAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [stage, setStage] = useState(0);
  const [count, setCount] = useState(0);
  const [verbIdx, setVerbIdx] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const verbRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const play = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    if (tickerRef.current) clearInterval(tickerRef.current);
    if (verbRef.current) clearInterval(verbRef.current);
    setStage(0);
    setCount(0);
    setVerbIdx(0);

    timersRef.current = [
      setTimeout(() => setStage(1), 1000), //  pulse on laptop
      setTimeout(() => setStage(2), 2500), //  lid closes
      setTimeout(() => setStage(3), 4000), //  agent moves to host-b
      setTimeout(() => setStage(4), 5500), //  pulse on host-b
      setTimeout(() => setStage(5), 7000), //  lid opens
      setTimeout(() => setStage(6), 8500), //  agent moves back to laptop
      setTimeout(() => setStage(7), 10000), // pulse on laptop (welcome back)
    ];

    tickerRef.current = setInterval(() => {
      setCount((c) => c + 1);
    }, 350);

    verbRef.current = setInterval(() => {
      setVerbIdx((i) => (i + 1) % VERBS.length);
    }, 1400);
  }, []);

  useEffect(() => {
    if (inView) play();
    return () => {
      timersRef.current.forEach(clearTimeout);
      if (tickerRef.current) clearInterval(tickerRef.current);
      if (verbRef.current) clearInterval(verbRef.current);
    };
  }, [inView, play]);

  const onLaptop = stage < 3 || stage >= 6;
  const onHostB = stage >= 3 && stage < 6;
  const lidClosed = stage >= 2 && stage < 5;
  const laptopPulse = stage === 1 || stage === 7;
  const hostBPulse = stage === 4;
  const transit = stage === 3 ? "right" : stage === 6 ? "left" : null;

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
      aria-label="Replay handoff animation"
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
          position: "relative",
          display: "flex",
          gap: "1rem",
          alignItems: "flex-end",
        }}
      >
        <Laptop
          lidClosed={lidClosed}
          status={lidClosed ? "lid closed" : "running"}
        >
          {onLaptop && (
            <VMBlock
              pulse={laptopPulse}
              count={count}
              arc={!!transit}
              verb={VERBS[verbIdx]}
            />
          )}
        </Laptop>

        <Arrow direction={transit} />

        <Server status={onHostB ? "running" : "idle"} active={onHostB}>
          {onHostB && (
            <VMBlock
              pulse={hostBPulse}
              count={count}
              arc={!!transit}
              verb={VERBS[verbIdx]}
            />
          )}
        </Server>

        {/* Dashed-line transit overlay */}
        {transit && (
          <svg
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <motion.path
              d={
                transit === "right"
                  ? "M 22 55 Q 50 25 78 55"
                  : "M 78 55 Q 50 25 22 55"
              }
              fill="none"
              stroke="#888"
              strokeWidth="0.4"
              strokeDasharray="1.5 1.5"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: 1,
                opacity: 1,
                strokeDashoffset: [0, -6],
              }}
              transition={{
                pathLength: { duration: 0.4 },
                opacity: { duration: 0.2 },
                strokeDashoffset: {
                  duration: 0.6,
                  repeat: Infinity,
                  ease: "linear",
                },
              }}
            />
          </svg>
        )}
      </div>

      <div
        style={{
          textAlign: "center",
          marginTop: "1rem",
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

function MachineContainer({
  label,
  status,
  width,
  children,
}: {
  label: string;
  status: string;
  width: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: width, position: "relative" }}>
        {children}
      </div>
      <small style={{ marginTop: 8, color: "#444" }}>
        <strong>{label}</strong>{" "}
        <span style={{ color: "#888" }}>· {status}</span>
      </small>
    </div>
  );
}

function Laptop({
  lidClosed,
  status,
  children,
}: {
  lidClosed: boolean;
  status: string;
  children?: React.ReactNode;
}) {
  return (
    <MachineContainer label="laptop" status={status} width={240}>
      <div
        style={{
          width: "100%",
          paddingTop: "70%",
          position: "relative",
          perspective: "700px",
          perspectiveOrigin: "center 90%",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformStyle: "preserve-3d",
          }}
        >
          {/* Base / keyboard slab */}
          <div
            style={{
              position: "absolute",
              bottom: "6%",
              left: "6%",
              right: "6%",
              height: "14%",
              border: "1.5px solid currentColor",
              borderRadius: "2px",
              background: "white",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "30%",
                left: "10%",
                right: "10%",
                height: 1,
                background: "currentColor",
                opacity: 0.45,
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "65%",
                left: "10%",
                right: "10%",
                height: 1,
                background: "currentColor",
                opacity: 0.45,
              }}
            />
          </div>

          {/* Lid (rotates around the hinge) */}
          <motion.div
            initial={false}
            animate={{ rotateX: lidClosed ? -92 : 0 }}
            transition={{ duration: 1, ease: [0.6, 0.05, 0.4, 1] }}
            style={{
              position: "absolute",
              left: "10%",
              right: "10%",
              bottom: "20%",
              height: "70%",
              transformOrigin: "center bottom",
              transformStyle: "preserve-3d",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                border: "1.5px solid currentColor",
                borderRadius: "2px",
                background: "white",
                boxSizing: "border-box",
                padding: "8%",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: "6%",
                  border: "0.5px solid currentColor",
                  opacity: 0.4,
                  borderRadius: "1px",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                {children}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </MachineContainer>
  );
}

function Server({
  status,
  active,
  children,
}: {
  status: string;
  active: boolean;
  children?: React.ReactNode;
}) {
  return (
    <MachineContainer label="desktop" status={status} width={120}>
      <svg
        viewBox="0 0 120 140"
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        {/* Chassis */}
        <rect
          x="10"
          y="6"
          width="100"
          height="128"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        {/* Rack slot dividers */}
        <line
          x1="10"
          y1="34"
          x2="110"
          y2="34"
          stroke="currentColor"
          strokeWidth="0.6"
        />
        <line
          x1="10"
          y1="62"
          x2="110"
          y2="62"
          stroke="currentColor"
          strokeWidth="0.6"
        />
        <line
          x1="10"
          y1="90"
          x2="110"
          y2="90"
          stroke="currentColor"
          strokeWidth="0.6"
        />
        <line
          x1="10"
          y1="118"
          x2="110"
          y2="118"
          stroke="currentColor"
          strokeWidth="0.6"
        />

        {/* Highlight the slot that's hosting the agent */}
        <motion.rect
          x="10"
          y="62"
          width="100"
          height="28"
          fill="currentColor"
          initial={false}
          animate={{ opacity: active ? 0.08 : 0 }}
          transition={{ duration: 0.4 }}
        />

        {/* LEDs — first one pulses when active */}
        <motion.circle
          cx="20"
          cy="20"
          r="2"
          stroke="currentColor"
          strokeWidth="1"
          fill="currentColor"
          initial={false}
          animate={{ opacity: active ? [0.3, 1, 0.3] : 0 }}
          transition={
            active
              ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.3 }
          }
        />
        <circle
          cx="28"
          cy="20"
          r="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
        <circle
          cx="36"
          cy="20"
          r="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
        {/* Vents */}
        <line
          x1="40"
          y1="128"
          x2="80"
          y2="128"
          stroke="currentColor"
          strokeWidth="0.4"
        />
      </svg>
      {children && (
        <div
          style={{
            position: "absolute",
            top: "44%",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          {children}
        </div>
      )}
    </MachineContainer>
  );
}

function VMBlock({
  pulse,
  count,
  arc,
  verb,
}: {
  pulse?: boolean;
  count: number;
  arc?: boolean;
  verb: string;
}) {
  return (
    <motion.div
      layoutId="vm"
      style={{
        padding: "6px 12px",
        border: "1px solid #333",
        background: "white",
        color: "#222",
        fontFamily: "ui-monospace, monospace",
        whiteSpace: "nowrap",
        textAlign: "center",
        lineHeight: 1.3,
      }}
      animate={{
        scale: pulse ? [1, 1.15, 1] : 1,
        y: arc ? [0, -22, 0] : 0,
      }}
      transition={{
        scale: { duration: 0.9 },
        y: { duration: 1.1, ease: "easeInOut" },
        layout: { duration: 1.1, ease: "easeInOut" },
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 500 }}>agent</div>
      <motion.div
        key={verb}
        initial={{ opacity: 0, y: 2 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          fontSize: 9,
          color: "#777",
          marginTop: 1,
        }}
      >
        ✻ {verb}… · {count}
      </motion.div>
    </motion.div>
  );
}

function Arrow({ direction }: { direction: "left" | "right" | null }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0 4px",
        color: direction ? "#222" : "#aaa",
        fontSize: 18,
        height: 140,
        transition: "color 0.3s",
      }}
    >
      {direction === "right" ? "→" : direction === "left" ? "←" : "⇄"}
    </div>
  );
}
