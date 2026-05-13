# Machinen

**Hand off a running coding agent. Between your machines.**

Between your laptop and your desktop. Between your laptop and Machinen Cloud. The whole VM moves — every process, every byte of memory, every open file, every timer. The agent never restarts. It picks up exactly where it left off.

[Read the docs →](https://github.com/redwoodjs/machinen.dev) · `pnpm add @machinen/cli @machinen/runtime`

## The round trip

Your agent is building a feature on your laptop — but you've got to step out. You close your lid and everything pauses: the running test, the open file handles, the half-written diff. Ship the frozen VM to your desktop. Thaw it, and the agent resumes the diff exactly where it stopped. Tomorrow morning, ship it back to your laptop. It never noticed it moved.

## How it looks

The whole arc in one walkthrough: bake the VM, boot it, drive it from your Node process, snapshot it, restore it on another machine. Same primitives in TypeScript or at the shell.

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

## What handoff buys you

Three motions fall out of being able to freeze and thaw a running VM.

**Snapshot** — write the running state to disk. Memory, file descriptors, timers, all of it. The bundle is a directory you can ship anywhere.

**Restore** — thaw a snapshot on another host. The agent comes up exactly where it left off.

**Fork** — snapshot and restore at the same time, without killing the source. Two agents, same context, same loaded repo, diverging from this instant. Set N copies on the same task — let each try a different approach, and keep the one that lands.

```ts
const child = await vm.fork({ name: "agent-b" });
// Two agents. Same heap. Diverging from this instant.
```

```bash
$ machinen fork agent --new-name agent-b --detach
```

## Not a container.

Machinen runs real Linux microVMs — that's what makes snapshot and restore possible in the first place. You build the VM in TypeScript: install packages, write files, set the command. Everything in code. No Dockerfile.

## Live mounts and port forwards

Drop a host directory into the guest under `/mnt/`; the VM sees edits instantly, over a FUSE-over-vsock channel. Forward as many guest ports to the host as you want — no NAT setup. Both shown inline in the walkthrough above.

## Compatibility

Runs on Apple Silicon Macs, bare-metal arm64 Linux, and Graviton .metal — anywhere `/dev/kvm` is available (or Hypervisor.framework, on macOS).

---

> Note: the runtime source isn't public yet. Coming soon. [github.com/redwoodjs/machinen.dev](https://github.com/redwoodjs/machinen.dev)
