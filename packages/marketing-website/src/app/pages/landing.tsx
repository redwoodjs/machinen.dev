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
// Two agents. Same heap. Diverging from this instant.`;

const FORK_CLI = `$ machinen fork agent --new-name agent-b --detach`;

export const Landing = () => (
  <>
    <header>
      <a href="/" aria-label="Machinen">
        <img src="/logo.svg" alt="Machinen" width="280" />
      </a>
    </header>
    <main>
      <h1>Hand off a running coding agent. Between your machines.</h1>
      <p>
        Between your laptop and your desktop. Between your laptop and
        Machinen Cloud. The whole VM moves — every process, every byte of
        memory, every open file, every timer. The agent never restarts. It
        picks up exactly where it left off.
      </p>

      <p>
        <a href="https://github.com/redwoodjs/machinen.dev">Read the docs →</a>{" "}
        ·{" "}
        <code>pnpm add @machinen/cli @machinen/runtime</code>
      </p>

      <section>
        <h2>The round trip.</h2>
        <p>
          Your agent is building a feature on your laptop — but you've got to
          step out. You close your lid and everything pauses: the running
          test, the open file handles, the half-written diff. Ship the frozen
          VM to your desktop. Thaw it, and the agent resumes the diff exactly
          where it stopped. Tomorrow morning, ship it back to your laptop.
          It never noticed it moved.
        </p>
        <HandoffAnimation />
      </section>

      <section>
        <h2>How it looks.</h2>
        <p>
          The whole arc in one walkthrough: bake the VM, boot it, drive it
          from your Node process, snapshot it, restore it on another
          machine. Same primitives in TypeScript or at the shell.
        </p>
        <CodeTabs sdk={ROUND_TRIP_SDK} cli={ROUND_TRIP_CLI} />
      </section>

      <section>
        <h2>What handoff buys you.</h2>
        <p>
          Three motions fall out of being able to freeze and thaw a running
          VM.
        </p>
        <p>
          <strong>Snapshot</strong> — write the running state to disk. Memory,
          file descriptors, timers, all of it. The bundle is a directory you
          can ship anywhere.
        </p>
        <p>
          <strong>Restore</strong> — thaw a snapshot on another host. The
          agent comes up exactly where it left off.
        </p>
        <p>
          <strong>Fork</strong> — snapshot and restore at the same time,
          without killing the source. Two agents, same context, same loaded
          repo, diverging from this instant. Set N copies on the same task —
          let each try a different approach, and keep the one that lands.
        </p>
        <ForkAnimation />
        <CodeTabs sdk={FORK_SDK} cli={FORK_CLI} />
      </section>

      <section>
        <h2>Not a container.</h2>
        <p>
          Machinen runs real Linux microVMs — that's what makes snapshot and
          restore possible in the first place. You build the VM in
          TypeScript: install packages, write files, set the command.
          Everything in code. No Dockerfile.
        </p>
      </section>

      <section>
        <h2>Live mounts and port forwards.</h2>
        <p>
          Drop a host directory into the guest under <code>/mnt/</code>; the
          VM sees edits instantly, over a FUSE-over-vsock channel. Forward as
          many guest ports to the host as you want — no NAT setup. Both shown
          inline in the walkthrough above.
        </p>
      </section>

      <section>
        <h2>Compatibility</h2>
        <p>
          Runs on Apple Silicon Macs, bare-metal arm64 Linux, and Graviton
          .metal — anywhere <code>/dev/kvm</code> is available (or
          Hypervisor.framework, on macOS).
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
