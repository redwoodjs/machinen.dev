# Quickstart

You're going to build a tiny HTTP server, boot it inside a VM, hit it a few
times so it accumulates state in memory, then move that running process to
another machine and watch it pick up exactly where it left off.

This is the trick machinen exists for: the program's entire state — what
it's holding in memory, the connections it has open, the files it's
reading — travels with it. Three steps.

## 1. Bake an image

Start with a Node.js server that counts requests in memory — nothing
persistent, no database. The whole point is that "in memory" survives the
move.

```js
// counter.mjs
import { createServer } from "node:http";
let count = 0;
createServer((_, res) => {
  res.end(JSON.stringify({ count: ++count }) + "\n");
}).listen(3000);
```

To run it inside a VM you need a rootfs tarball: a Linux filesystem with
Node installed, your script copied in, and a default command that launches
it. `provision()` builds that for you. Under the hood it boots a Debian
base, runs the install steps you give it, then archives the result.

```ts
// bake.ts
import { readFileSync } from "node:fs";
import { provision } from "@machinen/runtime";

await provision({
  install: async (vm) => {
    await vm.exec("apt-get update && apt-get install -y nodejs");
    await vm.writeFile("/opt/counter.mjs", readFileSync("./counter.mjs"));
  },
  cmd: ["/usr/bin/node", "/opt/counter.mjs"],
  out: "./counter.tar.gz",
});
```

```bash
node bake.ts
```

You now have `counter.tar.gz` — a self-contained image you can boot
anywhere machinen runs.

## 2. Boot it and give it some state

```bash
npx machinen boot --name counter -p 3000:3000 --detached ./counter.tar.gz
curl localhost:3000                        # { count: 1 }
curl localhost:3000                        # { count: 2 }
```

A few things are happening here. `--name counter` registers the VM under
a name so you can reach it from another shell. `-p 3000:3000` forwards the
host port to the guest. `--detached` lets the boot command return as soon
as the guest is ready, instead of holding your terminal.

After the two `curl`s, the Node process inside the VM has `count = 2` in
its heap. That's the state we're about to move.

## 3. Hand it off to another machine

`machinen snapshot` freezes the running VM into a directory on disk. The
directory is the whole snapshot: `disk.img` is the workload's memory and
file descriptors as a CRIU dump on an ext4 volume; `meta.json` is a small
manifest.

```bash
npx machinen snapshot counter ./counter.snap
scp -r ./counter.snap host-b:
ssh host-b npx machinen restore ./counter.snap -p 3000:3000 &
curl host-b:3000                           # { count: 3 }
```

The third `curl` returns `{ count: 3 }` because it's the same process —
it just resumed on a different host. Same heap, same TCP listener, same
counter. The Node runtime never noticed the move.

A constraint to know about: the host architectures have to match. arm64
to arm64 works (your laptop to a Graviton instance, say). arm64 to x86
does not — CRIU is replaying actual machine-code register state, and that
doesn't translate.

## Where to go next

- [Create a VM](./guides/create-a-vm.md) once you want more control over
  what's inside.
- [Snapshot, restore, and fork](./guides/snapshot-restore-fork.md) covers
  the cloning trick — running two copies of the same process at once.
- [Mount files into a VM](./guides/mount-files.md) for sharing data
  between the host and guest.
- [Networking](./guides/networking.md) for how the guest reaches the
  internet and how to expose more ports.
