# Machinen

**Boot Once, Run Everywhere.**

Between your laptop and your desktop. Between your laptop and Machinen Cloud. The whole VM moves — every process, every byte of memory, every open file, every timer. The agent never restarts. It picks up exactly where it left off.

[Read the docs →](https://github.com/redwoodjs/machinen.dev) · `pnpm add @machinen/cli @machinen/runtime`

## Pause here. Resume there.

Your agent is mid-task on your laptop, but you need to leave. Machinen freezes the whole VM — the running process, memory, open files, and timers — into a snapshot. Move that snapshot to your desktop and restore it. The agent picks up from the same moment, without rebuilding context or starting over. Send it back later the same way.

## Use it from TypeScript or the shell.

The workflow is the same either way: bake an image, boot the VM, run commands inside it, snapshot it, and restore it on another machine. Use the TypeScript API when you're building automation, or the CLI when you're working from a terminal.

**SDK**

```ts
import { provision, boot, restore } from "@machinen/runtime";

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
const resumed = await restore({ snapDir: "./agent.snap" });
```

**CLI**

```bash
# 1. Bake the VM.
$ node bake.ts
# → ./agent.tar.gz

# 2. Boot it on your laptop.
$ machinen boot ./agent.tar.gz --name agent --detached \
    --mount-live ./workspace:/mnt/workspace \
    -p 3000:3000

# 3. Drive the VM.
$ machinen exec agent -- apt-get install -y python3
$ machinen exec agent -- ls /opt

# 4. Battery's dying. Snapshot and ship.
$ machinen snapshot agent ./agent.snap
$ scp ./agent.tar.gz ./agent.snap desktop:

# 5. On your desktop: restore.
$ ssh desktop machinen restore ./agent.snap
```

## Freeze, move, or copy a running VM.

Once Machinen can pause a VM without losing its state, you get three useful operations.

**Snapshot** — save the VM exactly as it is right now: memory, open files, timers, and running processes.

**Restore** — start that snapshot on another machine. The agent continues from the same moment instead of booting from scratch.

**Fork** — make a copy of the running VM and let both continue. Spin up several agents from the same warm state, let them try different approaches, and keep the result that works.

```ts
const child = await vm.fork({ name: "agent-b" });
// agent-b starts from the same running state, then goes its own way.
```

```bash
$ machinen fork agent --new-name agent-b --detach
```

## A real Linux VM, defined in TypeScript.

Machinen runs microVMs, not containers. Snapshot and restore happen at the VM boundary, so the guest moves as one unit: kernel, processes, memory, files, and timers. Build the image in TypeScript: install packages, write files, choose the command. No Dockerfile.

## Mount files and forward ports.

Mount a host directory into the VM under `/mnt/`, and the guest sees your edits as you make them. Forward guest ports to your host with one option. No networking setup, no NAT rules.

## Runs on Macs and arm64 Linux.

Machinen runs on Apple Silicon Macs, arm64 Linux machines, Raspberry Pi, and Graviton .metal instances. On Linux it uses `/dev/kvm`; on macOS it uses Hypervisor.framework.

---

> Note: the runtime source isn't public yet. Coming soon. [github.com/redwoodjs/machinen.dev](https://github.com/redwoodjs/machinen.dev)
