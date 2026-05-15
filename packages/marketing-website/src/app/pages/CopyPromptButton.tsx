"use client";

import { useState } from "react";

export function CopyPromptButton({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false);

  const copyPrompt = async () => {
    const prompt = await fetch("/llms.txt").then((res) => res.text());
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button type="button" onClick={copyPrompt} className={className}>
      {copied ? "Copied" : "Copy Prompt"}
    </button>
  );
}
