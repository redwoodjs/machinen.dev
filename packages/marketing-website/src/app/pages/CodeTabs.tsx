"use client";

import { useState } from "react";

export function CodeTabs({ sdk, cli }: { sdk: string; cli: string }) {
  const [tab, setTab] = useState<"sdk" | "cli">("sdk");

  return (
    <div>
      <div role="tablist" style={{ display: "flex", gap: "0.25rem" }}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "sdk"}
          onClick={() => setTab("sdk")}
          style={tabButtonStyle(tab === "sdk")}
        >
          SDK
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "cli"}
          onClick={() => setTab("cli")}
          style={tabButtonStyle(tab === "cli")}
        >
          CLI
        </button>
      </div>
      <pre style={{ marginTop: 0 }}>
        <code>{tab === "sdk" ? sdk : cli}</code>
      </pre>
    </div>
  );
}

const tabButtonStyle = (active: boolean): React.CSSProperties => ({
  padding: "0.35rem 0.75rem",
  border: "none",
  borderBottom: active ? "2px solid currentColor" : "2px solid transparent",
  background: "transparent",
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
  opacity: active ? 1 : 0.55,
});
