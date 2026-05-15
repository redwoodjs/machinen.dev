import { HandoffAnimation } from "./HandoffAnimation";
import { ForkAnimation } from "./ForkAnimation";

const ROUND_TRIP_SDK = `import { provision, boot, restore } from "@machinen/runtime";

// 1. Bake the VM. Install the agent's toolchain, write its entrypoint.
await provision({
  install: async (vm) => {
    await vm.exec("apt-get install -y nodejs git");
    await vm.writeFile("/opt/agent.mjs", code);
  },
  cmd: ["node", "/opt/agent.mjs"],
  out: "./agent.tar.gz",
});

// 2. Boot it on your laptop.
const vm = await boot({
  image: "./agent.tar.gz",
  name: "agent",
  liveMounts: [{ host: "./workspace", guest: "/mnt/workspace" }],
  portForward: [{ hostPort: 3000, guestPort: 3000 }],
});

// 3. Drive the VM from your Node process.
await vm.exec("apt-get install -y python3");
await vm.writeFile("/etc/agent.conf", config);

// 4. Snapshot the whole VM to disk, ship the bundle.
await vm.snapshot({ outDir: "./agent.snap" });

// 5. On your desktop: restore. Same heap, same open files.
const resumed = await restore({ snapDir: "./agent.snap" });`;

const FORK_SDK = `const child = await vm.fork({ name: "agent-b" });
// Two agents. Same heap. Diverging from this instant.`;

const TS_KEYWORDS = /\b(import|from|const|let|await|async|new|return|if|else|export)\b/g;
const TS_TYPES = /\b(string|number|boolean|void|any|Promise)\b/g;
const TS_STRING = /("(?:\\.|[^"\\])*")/g;
const TS_COMMENT = /(\/\/[^\n]*)/g;
const TS_FUNC = /\b(provision|boot|restore|exec|writeFile|snapshot|fork|sync)\b(?=\()/g;

function highlightTS(code: string) {
  return code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(TS_COMMENT, '<span style="color:#7C7CA8">$1</span>')
    .replace(TS_STRING, '<span style="color:#2E47A0">$1</span>')
    .replace(TS_KEYWORDS, '<span style="color:#5A2EA0;font-weight:500">$1</span>')
    .replace(TS_TYPES, '<span style="color:#2E47A0">$1</span>')
    .replace(TS_FUNC, '<span style="color:#0E0E47;font-weight:500">$1</span>');
}

function BracketNav() {
  const items = [
    { key: "Q", label: "Quickstart", href: "#round-trip" },
    { key: "C", label: "CLI", href: "#walkthrough" },
    { key: "F", label: "Fork", href: "#fork" },
    { key: "A", label: "Agents", href: "#agents" },
    { key: "D", label: "Docs", href: "#compat" },
  ];
  return (
    <nav className="border-b border-[#E1E1F0] bg-[#F4F4FB]/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 text-[#0E0E47] font-semibold tracking-tight">
          <span className="inline-block w-7 h-7 rounded-sm bg-[#2026A0] text-white grid place-items-center text-sm font-bold">M</span>
          machinen
        </a>
        <div className="hidden md:flex items-center gap-7 text-[15px] text-[#0E0E47]">
          {items.map((it) => (
            <a key={it.key} href={it.href} className="hover:text-[#2026A0] transition-colors">
              <span className="text-[#A8A8D0] mr-1.5 font-mono text-[13px]">[{it.key}]</span>
              {it.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <a href="https://github.com/redwoodjs/machinen.dev" className="text-[15px] text-[#0E0E47] hover:text-[#2026A0]">GitHub</a>
          <a href="https://github.com/redwoodjs/machinen.dev" className="bg-[#2026A0] hover:bg-[#181D80] text-white text-[15px] font-medium px-4 py-2 rounded">Get started</a>
        </div>
      </div>
    </nav>
  );
}

function CodeBlock({
  filename,
  code,
  terminalOutput,
}: {
  filename: string;
  code: string;
  terminalOutput?: { command: string; result: string };
}) {
  return (
    <div className="rounded-md border border-[#D5D5EC] bg-white overflow-hidden shadow-[0_1px_0_rgba(14,14,71,0.04)]">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#E8E8F2]">
        <span className="font-mono text-[14px] font-semibold text-[#0E0E47]">{filename}</span>
        <a href="https://github.com/redwoodjs/machinen.dev" className="flex items-center gap-1.5 text-[13px] text-[#5C5C8C] hover:text-[#2026A0]">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 005.47 7.59c.4.07.55-.17.55-.38v-1.34c-2.23.48-2.7-1.07-2.7-1.07-.36-.93-.89-1.18-.89-1.18-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.6 7.6 0 018 4.16c.68 0 1.36.09 2 .27 1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.74-3.65 3.94.29.25.54.73.54 1.47v2.18c0 .21.15.46.55.38A8 8 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          See example
        </a>
      </div>
      <pre className="px-5 py-4 text-[13.5px] leading-[1.65] font-mono text-[#0E0E47] overflow-x-auto">
        <code dangerouslySetInnerHTML={{ __html: highlightTS(code) }} />
      </pre>
      {terminalOutput && (
        <div className="bg-[#2026A0] text-white font-mono text-[13px] px-5 py-3 leading-[1.6]">
          <div className="opacity-80">{terminalOutput.command}</div>
          <div>{terminalOutput.result}</div>
        </div>
      )}
    </div>
  );
}

function VMCard() {
  return (
    <div className="rounded-md border border-[#D5D5EC] bg-white shadow-[0_8px_24px_-12px_rgba(32,38,160,0.25)] w-[340px]">
      <div className="px-5 py-4 border-b border-[#E8E8F2] flex items-center gap-2">
        <span className="w-5 h-5 rounded-sm bg-[#E5E5F7] grid place-items-center text-[#2026A0] font-mono text-[11px] font-bold">VM</span>
        <span className="font-semibold text-[#0E0E47]">agent</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-[#5C5C8C]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2EA065] animate-pulse" />
          running
        </span>
      </div>
      <div className="text-[13px]">
        <Row label="PID" value="1" mono />
        <Row label="Memory" value="412 MB / 2 GB" />
        <Row label="Uptime" value="2h 14m" />
        <Row label="Mount" value="./workspace → /mnt/workspace" mono />
        <Row label="Port" value=":3000 → :3000" mono />
        <Row label="State" value="resumable" tag />
      </div>
    </div>
  );
}

function Row({ label, value, mono, tag }: { label: string; value: string; mono?: boolean; tag?: boolean }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 px-5 py-2.5 border-b border-[#F0F0F8] last:border-b-0 items-center">
      <span className="text-[#7878A0]">{label}</span>
      {tag ? (
        <span className="inline-flex bg-[#E5E5F7] text-[#2026A0] px-2 py-0.5 rounded-sm w-fit text-[12px] font-medium">{value}</span>
      ) : (
        <span className={`text-[#0E0E47] ${mono ? "font-mono text-[12.5px]" : ""}`}>{value}</span>
      )}
    </div>
  );
}

function PixelTile({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`w-14 h-14 grid place-items-center rounded ${accent ? "bg-white border border-[#D5D5EC]" : "bg-[#E5E5F7]"}`}
        style={{ imageRendering: "pixelated" }}
      >
        <PixelGlyph label={label} />
      </div>
      <span className="text-[12px] text-[#5C5C8C]">{label}</span>
    </div>
  );
}

function PixelGlyph({ label }: { label: string }) {
  const initial = label[0].toUpperCase();
  return (
    <svg width="32" height="32" viewBox="0 0 8 8" aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" fill="#2026A0" />
      <text
        x="4"
        y="5.5"
        textAnchor="middle"
        fontSize="4"
        fontFamily="ui-monospace, monospace"
        fontWeight="700"
        fill="white"
      >
        {initial}
      </text>
    </svg>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[12px] tracking-[0.12em] uppercase text-[#2026A0] mb-3">
      {children}
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[40px] leading-[1.1] tracking-tight font-semibold text-[#0E0E47] mb-5">{children}</h2>;
}

function Lede({ children }: { children: React.ReactNode }) {
  return <p className="text-[17px] leading-[1.6] text-[#3A3A6B] max-w-[640px]">{children}</p>;
}

export const LandingLight = () => (
  <div className="bg-[#F4F4FB] text-[#0E0E47] min-h-screen font-sans antialiased">
    <BracketNav />

    {/* hero */}
    <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
      <Eyebrow>[M] Machinen runtime</Eyebrow>
      <h1 className="text-[64px] leading-[1.02] tracking-[-0.02em] font-semibold max-w-[860px] mb-6">
        Hand off a running coding agent. <span className="text-[#2026A0]">Between your machines.</span>
      </h1>
      <p className="text-[19px] leading-[1.55] text-[#3A3A6B] max-w-[680px] mb-8">
        Between your laptop and your desktop. Between your laptop and Machinen Cloud.
        The whole VM moves — every process, every byte of memory, every open file,
        every timer. The agent never restarts.
      </p>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <a href="https://github.com/redwoodjs/machinen.dev" className="bg-[#2026A0] hover:bg-[#181D80] text-white text-[15px] font-medium px-5 py-3 rounded">
          Read the docs →
        </a>
        <code className="font-mono text-[14px] bg-white border border-[#D5D5EC] px-4 py-3 rounded text-[#0E0E47]">
          pnpm add @machinen/cli @machinen/runtime
        </code>
      </div>
    </section>

    {/* round trip */}
    <section id="round-trip" className="max-w-6xl mx-auto px-6 py-20 border-t border-[#E1E1F0]">
      <Eyebrow>[R] The round trip</Eyebrow>
      <H2>Close the lid. Open it elsewhere.</H2>
      <Lede>
        Your agent is building a feature on your laptop — but you've got to step out.
        You close your lid and everything pauses: the running test, the open file
        handles, the half-written diff. Ship the frozen VM to your desktop. Thaw it,
        and the agent resumes exactly where it stopped.
      </Lede>
      <div className="mt-10">
        <HandoffAnimation />
      </div>
    </section>

    {/* code + VM card tableau */}
    <section id="walkthrough" className="max-w-6xl mx-auto px-6 py-20 border-t border-[#E1E1F0]">
      <Eyebrow>[W] Walkthrough</Eyebrow>
      <H2>The whole arc, in code.</H2>
      <Lede>
        Bake the VM. Boot it. Drive it from your Node process. Snapshot, restore.
        Same primitives in TypeScript or at the shell.
      </Lede>

      {/* integration tiles row */}
      <div className="mt-10 flex items-center gap-6">
        <PixelTile label="Claude" accent />
        <PixelTile label="Codex" />
        <PixelTile label="Aider" />
        <span className="text-[14px] text-[#5C5C8C] ml-1">and others</span>
      </div>

      {/* code panel + floating VM card with dotted connectors */}
      <div className="mt-8 relative">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-start">
          <CodeBlock
            filename="agent.ts"
            code={ROUND_TRIP_SDK}
            terminalOutput={{
              command: "machinen > boot agent",
              result: "Booted in 380 ms. Listening on :3000.",
            }}
          />
          <div className="hidden lg:flex flex-col items-center gap-4 pt-20 lg:translate-x-[-40px] z-10">
            <div className="w-9 h-9 rounded grid place-items-center bg-[#2026A0] text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
              </svg>
            </div>
            <VMCard />
          </div>
        </div>
        <div className="lg:hidden mt-6">
          <VMCard />
        </div>
      </div>

      {/* dotted "system" container hint */}
      <div className="mt-10 border border-dashed border-[#A8A8D0] rounded-md p-6 text-[13px] text-[#5C5C8C] font-mono">
        machinen runtime · 1 VM · 1 mount · 1 port forward
      </div>
    </section>

    {/* fork section */}
    <section id="fork" className="max-w-6xl mx-auto px-6 py-20 border-t border-[#E1E1F0]">
      <Eyebrow>[F] What handoff buys you</Eyebrow>
      <H2>Snapshot. Restore. <span className="text-[#2026A0]">Fork.</span></H2>
      <Lede>
        Three motions fall out of being able to freeze and thaw a running VM.
      </Lede>

      <div className="grid md:grid-cols-3 gap-6 mt-10">
        {[
          { name: "Snapshot", body: "Write the running state to disk. Memory, file descriptors, timers, all of it. The bundle is a directory you can ship anywhere." },
          { name: "Restore", body: "Thaw a snapshot on another host. The agent comes up exactly where it left off." },
          { name: "Fork", body: "Snapshot and restore at the same time, without killing the source. Children inherit the same heap and diverge from there." },
        ].map((c) => (
          <div key={c.name} className="bg-white border border-[#D5D5EC] rounded-md p-6">
            <div className="font-mono text-[12px] text-[#2026A0] uppercase tracking-wider mb-2">{c.name}</div>
            <div className="text-[14.5px] leading-[1.55] text-[#3A3A6B]">{c.body}</div>
          </div>
        ))}
      </div>

      <div className="mt-12 grid lg:grid-cols-2 gap-10 items-center">
        <ForkAnimation />
        <CodeBlock
          filename="fork.ts"
          code={FORK_SDK}
          terminalOutput={{
            command: "machinen > fork agent --new-name agent-b",
            result: "Forked in 210 ms. agent + 1 child diverging.",
          }}
        />
      </div>
    </section>

    {/* agents pixel tiles */}
    <section id="agents" className="max-w-6xl mx-auto px-6 py-20 border-t border-[#E1E1F0]">
      <Eyebrow>[A] Agents</Eyebrow>
      <H2>Bring your own agent.</H2>
      <Lede>
        Machinen is the runtime. Anything that runs in a Linux process runs in a
        Machinen VM — and can be snapshotted, forked, or moved.
      </Lede>
      <div className="mt-10 flex flex-wrap items-center gap-6">
        <PixelTile label="Claude" accent />
        <PixelTile label="Codex" />
        <PixelTile label="Aider" />
        <PixelTile label="Devin" />
        <PixelTile label="Goose" />
        <span className="text-[14px] text-[#5C5C8C]">and others</span>
      </div>
    </section>

    {/* compatibility */}
    <section id="compat" className="max-w-6xl mx-auto px-6 py-20 border-t border-[#E1E1F0]">
      <Eyebrow>[P] Platform</Eyebrow>
      <H2>Not a container.</H2>
      <Lede>
        Machinen runs real Linux microVMs — that's what makes snapshot and restore
        possible in the first place. You build the VM in TypeScript: install
        packages, write files, set the command. Everything in code. No Dockerfile.
      </Lede>
      <div className="mt-8 grid md:grid-cols-3 gap-4 text-[14px]">
        {["Apple Silicon Macs", "Bare-metal arm64 Linux", "Graviton .metal"].map((p) => (
          <div key={p} className="border border-dashed border-[#A8A8D0] rounded-md px-4 py-3 font-mono text-[#0E0E47]">
            {p}
          </div>
        ))}
      </div>
    </section>

    {/* footer / note */}
    <footer className="max-w-6xl mx-auto px-6 py-16 border-t border-[#E1E1F0]">
      <div className="bg-white border border-[#D5D5EC] rounded-md p-6">
        <div className="font-mono text-[12px] uppercase tracking-wider text-[#2026A0] mb-2">[N] Note</div>
        <p className="text-[15px] text-[#3A3A6B] leading-[1.55]">
          The runtime source isn't public yet. Coming soon.{" "}
          <a href="https://github.com/redwoodjs/machinen.dev" className="text-[#2026A0] hover:underline">
            github.com/redwoodjs/machinen.dev
          </a>
        </p>
      </div>
    </footer>
  </div>
);
