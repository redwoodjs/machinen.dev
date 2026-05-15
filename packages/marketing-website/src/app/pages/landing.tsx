import { CodeTabs } from "./CodeTabs";
import { ForkAnimation } from "./ForkAnimation";
import { HandoffAnimation } from "./HandoffAnimation";

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

export const Landing = () => (
  <>
    <header>
      <a href="/" aria-label="Machinen">
        <img src="/logo.svg" alt="Machinen" width="280" />
      </a>
    </header>
    <main>
      <h1>Boot once. Run anywhere.</h1>
      <p>
        A MicroVM that runs on hardware you already own.
        <br />
        Close your laptop and it hands off to another host.
        <br />
        Works across macOS and Linux.
      </p>

      <p>
        <a href="https://github.com/redwoodjs/machinen.dev">Read the docs →</a>{" "}
        ·{" "}
        <code>pnpm add @machinen/cli @machinen/runtime</code>
      </p>

      <section>
        <h2>Pause here. Resume there.</h2>
        <p>
          Your agent is mid-task on your laptop, but you need to leave.
          Machinen freezes the whole VM — the running process, memory, open
          files, and timers — into a snapshot. Move that snapshot to your
          desktop and restore it. The agent picks up from the same moment,
          without rebuilding context or starting over. Send it back later the
          same way.
        </p>
        <HandoffAnimation />
      </section>

      <section>
        <h2>Use it from TypeScript or the shell.</h2>
        <p>
          The workflow is the same either way: bake an image, boot the VM,
          run commands inside it, snapshot it, and restore it on another
          machine. Use the TypeScript API when you're building automation,
          or the CLI when you're working from a terminal.
        </p>
        <CodeTabs sdk={ROUND_TRIP_SDK} cli={ROUND_TRIP_CLI} />
      </section>

      <section>
        <h2>Freeze, move, or copy a running VM.</h2>
        <p>
          Once Machinen can pause a VM without losing its state, you get
          three useful operations.
        </p>
        <p>
          <strong>Snapshot</strong> — save the VM exactly as it is right now:
          memory, open files, timers, and running processes.
        </p>
        <p>
          <strong>Restore</strong> — start that snapshot on another machine.
          The agent continues from the same moment instead of booting from
          scratch.
        </p>
        <p>
          <strong>Fork</strong> — make a copy of the running VM and let both
          continue. Spin up several agents from the same warm state, let them
          try different approaches, and keep the result that works.
        </p>
        <ForkAnimation />
        <CodeTabs sdk={FORK_SDK} cli={FORK_CLI} />
      </section>

      <section>
        <h2>A real Linux VM, defined in TypeScript.</h2>
        <p>
          Machinen runs microVMs, not containers. Snapshot and restore happen
          at the VM boundary, so the guest moves as one unit: kernel,
          processes, memory, files, and timers. Build the image in
          TypeScript: install packages, write files, choose the command. No
          Dockerfile.
        </p>
      </section>

      <section>
        <h2>Mount files and forward ports.</h2>
        <p>
          Mount a host directory into the VM under <code>/mnt/</code>, and the
          guest sees your edits as you make them. Forward guest ports to your
          host with one option. No networking setup, no NAT rules.
        </p>
      </section>

      <section>
        <h2>Runs on Macs and arm64 Linux.</h2>
        <p>
          Machinen runs on Apple Silicon Macs, arm64 Linux machines, and
          Graviton .metal instances. On Linux it uses <code>/dev/kvm</code>;
          on macOS it uses Hypervisor.framework.
        </p>
      </section>

      <p>
        <strong>Note:</strong> the runtime source isn't public yet. Coming
        soon.{" "}
        <a href="https://github.com/redwoodjs/machinen.dev">
          github.com/redwoodjs/machinen.dev
        </a>
      </p>
    </main>
  </>
);
