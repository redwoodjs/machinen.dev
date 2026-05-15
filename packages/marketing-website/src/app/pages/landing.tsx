import type { ReactNode } from "react";

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

// 2. Boot it on your laptop. Mount the workspace, forward the agent's port.
const vm = await boot({
  image: "./agent.tar.gz",
  name: "agent",
  liveMounts: [{ host: "./workspace", guest: "/mnt/workspace" }],
  portForward: [{ hostPort: 3000, guestPort: 3000 }],
});

// 3. Drive the VM from your Node process — exec commands, write files.
await vm.exec("apt-get install -y python3");
await vm.writeFile("/etc/agent.conf", config);

// 4. Battery's dying. Snapshot the whole VM to disk, ship the bundle.
await vm.snapshot({ outDir: "./agent.snap" });

// 5. On your desktop: restore. Same heap, same open files, same timers.
const resumed = await restore({ snapDir: "./agent.snap" });`;

const ROUND_TRIP_CLI = `# 1. Bake the VM.
$ node bake.ts
# → ./agent.tar.gz

# 2. Boot it on your laptop.
$ machinen boot ./agent.tar.gz --name agent --detached \\
    --mount-live ./workspace:/mnt/workspace \\
    -p 3000:3000

# 3. Drive the VM.
$ machinen exec agent -- apt-get install -y python3
$ machinen exec agent -- ls /opt

# 4. Battery's dying. Snapshot and ship.
$ machinen snapshot agent ./agent.snap
$ scp ./agent.tar.gz ./agent.snap desktop:

# 5. On your desktop: restore.
$ ssh desktop machinen restore ./agent.snap`;

const FORK_SDK = `const child = await vm.fork({ name: "agent-b" });
// agent-b starts from the same running state, then goes its own way.`;

const FORK_CLI = `$ machinen fork agent --new-name agent-b --detach`;

const ASCII_HEADING = String.raw` ____   ___   ___ _____    ___  _   _  ____ _____ 
| __ ) / _ \ / _ \_   _|  / _ \| \ | |/ ___| ____|
|  _ \| | | | | | || |   | | | |  \| | |   |  _|  
| |_) | |_| | |_| || |   | |_| | |\  | |___| |___ 
|____/ \___/ \___/ |_|    \___/|_| \_|\____|_____|

 ____  _   _ _   _      _    _   _ __   __ _    _ _   _ _____ ____  _____ 
|  _ \| | | | \ | |    / \  | \ | |\ \ / /| |  | | | | | ____|  _ \| ____|
| |_) | | | |  \| |   / _ \ |  \| | \ V / | |/\| | |_| |  _| | |_) |  _|  
|  _ <| |_| | |\  |  / ___ \| |\  |  | |  |  /\  |  _  | |___|  _ <| |___ 
|_| \_\\___/|_| \_| /_/   \_\_| \_|  |_|  |_/  \_|_| |_|_____|_| \_\_____|`;

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 select-none overflow-hidden text-brand font-bold whitespace-pre">
      {`=== ${children} ${"=".repeat(76)}`}
    </div>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="my-4 max-w-full">
      <div className="flex border border-[#333] border-b-0 bg-[#111] px-4 py-2 text-[#888] uppercase tracking-widest select-none">
        <span>{`> ${title}`}</span>
      </div>
      <div className="terminal-scroll overflow-x-auto border border-[#333] bg-[#0a0a0a] p-4">
        <pre className="text-[#88d088] leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

function PromptLine({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-brand font-bold">$</span>
      <span>{children}</span>
    </div>
  );
}

function Operation({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 font-bold text-white">&gt; {number}: {title}</div>
      <p className="max-w-[70ch] text-[#aaa]">{children}</p>
    </div>
  );
}

function DeepDive({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 font-bold text-white">&gt; {title}</div>
      <p className="max-w-[70ch] text-[#aaa]">{children}</p>
    </div>
  );
}

export const Landing = () => (
  <div className="min-h-screen bg-[#050505] text-[#ccc] font-mono">
    <div className="mx-auto w-full max-w-[100ch] px-4 py-8 leading-relaxed md:py-12">
      <nav className="mb-8 flex flex-col gap-4 border-b border-[#333] pb-4 text-[#888] sm:flex-row sm:justify-between">
        <div>
          <span className="text-brand">root@machinen</span><span className="text-white">:~</span>$ cat marketing.md
        </div>
        <div className="flex gap-6 uppercase tracking-widest">
          <a href="https://github.com/redwoodjs/machinen.dev" className="transition-all hover:text-white hover:underline">
            [Docs]
          </a>
          <a href="https://github.com/redwoodjs/machinen.dev" className="transition-all hover:text-white hover:underline">
            [GitHub]
          </a>
        </div>
      </nav>

      <main>
        <a href="/" aria-label="Machinen">
          <img src="/logo.svg" alt="Machinen" className="my-8 h-10 w-auto" />
        </a>

        <pre className="ascii-heading mb-8 mt-4 overflow-x-auto whitespace-pre text-[10px] font-bold leading-[1.1] text-white select-none sm:text-xs md:text-sm">{ASCII_HEADING}</pre>

        <h1 className="sr-only">Boot once. Run anywhere.</h1>
        <p className="mb-6 max-w-[65ch] text-[#aaa]">
          A MicroVM that runs on hardware you already own.<br />
          Close your laptop and it hands off to another host.<br />
          Works across macOS and Linux.
        </p>

        <div className="mb-8 mt-6 flex w-fit flex-col group">
          <div className="mb-1 text-[#666] select-none"># Install the packages</div>
          <PromptLine>
            <code className="text-white">pnpm add @machinen/cli @machinen/runtime</code>
          </PromptLine>
        </div>

        <div className="mb-16 space-y-1 text-[#888] select-none">
          <div className="mb-2 font-bold text-white">-- COMPATIBILITY --</div>
          <div>[x] Apple Silicon Macs</div>
          <div>[x] arm64 Linux machines</div>
          <div>[x] Graviton .metal</div>
          <div className="mt-2 text-[#555]">* /dev/kvm on Linux, Hypervisor.framework on macOS</div>
        </div>

        <section className="mb-16">
          <SectionTitle>PAUSE HERE. RESUME THERE.</SectionTitle>
          <p className="mb-8 max-w-[70ch] text-[#aaa]">
            Your agent is mid-task on your laptop, but you need to leave.
            Machinen freezes the whole VM — the running process, memory, open
            files, and timers — into a snapshot. Move that snapshot to your
            desktop and restore it. The agent picks up from the same moment,
            without rebuilding context or starting over. Send it back later the
            same way.
          </p>
          <div className="border border-[#333] bg-[#0a0a0a] p-4 text-[#888]">
            <PromptLine>machinen snapshot agent ./agent.snap</PromptLine>
            <div className="mt-2 pl-6 text-[#666]"># ship snapshot to another host</div>
            <PromptLine>machinen restore ./agent.snap</PromptLine>
            <div className="mt-2 pl-6 text-brand">ok: agent resumed from saved state</div>
          </div>
        </section>

        <section className="mb-16">
          <SectionTitle>USE IT FROM TYPESCRIPT OR THE SHELL.</SectionTitle>
          <p className="mb-8 max-w-[70ch] text-[#aaa]">
            The workflow is the same either way: bake an image, boot the VM,
            run commands inside it, snapshot it, and restore it on another
            machine. Use the TypeScript API when you're building automation,
            or the CLI when you're working from a terminal.
          </p>
          <CodeBlock title="handoff.ts" code={ROUND_TRIP_SDK} />
          <CodeBlock title="terminal.sh" code={ROUND_TRIP_CLI} />
        </section>

        <section className="mb-16">
          <SectionTitle>FREEZE, MOVE, OR COPY A RUNNING VM.</SectionTitle>
          <p className="mb-8 max-w-[70ch] text-[#aaa]">
            Once Machinen can pause a VM without losing its state, you get
            three useful operations.
          </p>

          <div className="flex flex-col gap-8">
            <Operation number="01" title="SNAPSHOT">
              Save the VM exactly as it is right now: memory, open files,
              timers, and running processes.
            </Operation>
            <Operation number="02" title="RESTORE">
              Start that snapshot on another machine. The agent continues from
              the same moment instead of booting from scratch.
            </Operation>
            <Operation number="03" title="FORK">
              Make a copy of the running VM and let both continue. Spin up
              several agents from the same warm state, let them try different
              approaches, and keep the result that works.
            </Operation>
          </div>

          <div className="mt-8">
            <CodeBlock title="fork.ts" code={`${FORK_SDK}\n\n${FORK_CLI}`} />
          </div>
        </section>

        <section className="mb-16">
          <SectionTitle>DEEP DIVES</SectionTitle>
          <div className="flex flex-col gap-8">
            <DeepDive title="A REAL LINUX VM, DEFINED IN TYPESCRIPT.">
              Machinen runs microVMs, not containers. Snapshot and restore
              happen at the VM boundary, so the guest moves as one unit:
              kernel, processes, memory, files, and timers. Build the image in
              TypeScript: install packages, write files, choose the command. No
              Dockerfile.
            </DeepDive>

            <DeepDive title="MOUNT FILES AND FORWARD PORTS.">
              Mount a host directory into the VM under <code>/mnt/</code>, and
              the guest sees your edits as you make them. Forward guest ports
              to your host with one option. No networking setup, no NAT rules.
            </DeepDive>

            <DeepDive title="RUNS ON MACS AND ARM64 LINUX.">
              Machinen runs on Apple Silicon Macs, arm64 Linux machines, and
              Graviton .metal instances. On Linux it uses <code>/dev/kvm</code>;
              on macOS it uses Hypervisor.framework.
            </DeepDive>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#333] pt-8 select-none">
        <div className="mb-4"><span className="animate-pulse text-brand">█</span></div>
        <p className="text-[#666]">
          Note: the runtime source isn't public yet. Coming soon.<br />
          <a href="https://github.com/redwoodjs/machinen.dev" className="text-[#888] underline hover:text-white">
            github.com/redwoodjs/machinen.dev
          </a>
        </p>
      </footer>
    </div>
  </div>
);
