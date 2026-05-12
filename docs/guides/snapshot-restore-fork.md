# Snapshot, restore, and fork

A snapshot is a complete picture of a running VM frozen to disk: every
page of memory, every open file descriptor, every TCP listener, the
program counter of every thread. Restoring it doesn't _start_ the
process — it _resumes_ it, like waking a laptop from sleep.

Two patterns get a lot of mileage out of that:

- **Move a long-running process to another machine.** Snapshot it on
  host A, copy the bundle, restore on host B. The process never noticed.
- **Clone a warmed-up process.** Snapshot it without killing it,
  immediately restore the bundle into a sibling VM. Now you have two
  copies of the same process running side by side.

This guide covers both. There's a constraint worth getting out of the
way first: same arch only. arm64 to arm64 works (laptop to Graviton).
arm64 to x86 does not — the snapshot includes machine-code register
state, and that doesn't translate.

## Moving a process between machines

Boot the workload, let it accumulate whatever in-memory state matters,
then snapshot:

```bash
npx machinen boot --name counter -p 3000:3000 --detached ./counter.tar.gz
# ... requests come in, the process builds up state ...
npx machinen snapshot counter ./counter.snap
```

`./counter.snap` is a directory holding two files: `disk.img` (the
process state, stored as CRIU images on an ext4 volume) and `meta.json`
(a small manifest with the source name and a timestamp). It's a
self-contained bundle — copy the whole directory and you've copied the
snapshot.

By default `snapshot` is destructive: the source VM exits as part of
the dump. CRIU kills the workload tree once it has the images, and the
VM shuts down cleanly. This is what you want for a _handoff_ — the
process should only be running in one place at a time.

To move it:

```bash
scp -r ./counter.snap host-b:
ssh host-b npx machinen restore ./counter.snap -p 3000:3000
```

`restore` takes the bundle directory and boots a VM that resumes from
that frozen state. The first request to host B picks up exactly where
the last request to host A left off — same heap, same connection
state, same counter value.

Port forwards aren't carried in the snapshot, so re-declare them on
restore — that's why `-p 3000:3000` reappears here.

From Node, the same flow:

```ts
import { boot, restore } from "@machinen/runtime";

const vm = await boot({ image: "./counter.tar.gz", name: "counter" });
// ... let it run ...
await vm.snapshot({ outDir: "./counter.snap" });

// possibly on another host:
const restored = await restore({ snapDir: "./counter.snap" });
```

Restored VMs without an explicit name get an auto-name shaped like
`<sourceName>/<pid>` so lineage shows up in `machinen ls`. You can pass
`--name` (CLI) or `name` (API) to override.

## Cloning a running process

The same machinery, used differently. If you snapshot _without_ killing
the source and immediately restore, you get two VMs running the same
process from the same instant. They share a heap up to that moment;
from then on they diverge.

That's what `fork` does:

```bash
npx machinen fork counter --new-name counter-b --detach
```

The source `counter` is unaffected — briefly frozen during the dump,
then resumes. `counter-b` is a fresh sibling with a copy of the same
heap. Both keep running independently.

```ts
const fork = await vm.fork({ name: "counter-b" });
```

There are two pieces of inherited state where the defaults are
deliberately _unsafe_ if you don't think about them:

**TCP connections.** The source had open sockets to clients; both VMs
can't hold the same connection without racing on sequence numbers.
`fork` defaults to dropping inherited connections in the fork — your
process sees `ECONNRESET` on first I/O. The source keeps them. Pass
`--tcp-keep` only if you genuinely want both copies talking on the
same connection (rare; usually means a load test or a CRIU experiment).

**Host port forwards.** A port like `:3000` is global on the host —
only one process can bind it. The source already does. So `fork`
doesn't inherit port forwards by default; the new VM has no exposed
ports. Either reach the fork via `machinen exec` (vsock, doesn't go
through host networking), or pass new forwards explicitly — both the
CLI and Node API accept them:

```bash
npx machinen fork counter --new-name counter-b -p 3001:3000
```

```ts
await vm.fork({
  name: "counter-b",
  portForward: [{ hostPort: 3001, guestPort: 3000 }],
});
```

If you pick a host port the source is already forwarding, the bind
probe fires `BOOT_PORT_FORWARD_IN_USE` with the holding VM's name —
not advice to `kill` it — so you know to pick a different host port.

### Boot-shaped flags work on the fork too

`fork` is `snapshot --keep-alive` + `restore` rolled into one call, so
anything you can pass at `boot` time also works on a fork — and lands
on the _forked sibling_, not the source. That covers `--mount`,
`--mount-live`, `--env`, `--cwd`, and `--memory`.

The source's own `--mount` payload was baked into its rootdisk before
the snapshot, so the fork inherits it via the disk image without you
re-passing anything. Use these flags when you want the fork to differ
from the source — e.g. layer in an additional input dir, set an env
var that wasn't there before, or hand the fork more RAM:

```bash
npx machinen fork worker --new-name worker-eval \
  --mount ./eval-fixtures:/mnt/in \
  --env RUN_MODE=eval \
  --memory 8192
```

Live mounts (`--mount-live`) on a fork establish a _fresh_ vsock FUSE
channel on the sibling. The source must not have its own live mount
active at fork time — vsock FUSE channels can't survive a CRIU dump,
which is why `vm.fork` rejects sources with live mounts. Tear down the
source's live mount, fork, and re-attach a new one if you need
write-through on both copies.

## When you need the source to survive the snapshot

Sometimes you want to snapshot a VM, hand someone the bundle for later
restore, and keep the source running. Pass `--keep-alive`:

```bash
npx machinen snapshot counter ./counter.snap --keep-alive
```

Same as fork's snapshot half: the source survives, and inherited TCP
sockets get closed in the bundle so a future restore won't fight the
source over connection state.

## Snapshot bundles are bigger than they look

The `disk.img` inside a bundle is the entire scratch disk that was
attached at boot time — by default ~8 GiB sparse. The CRIU images
themselves are usually small (proportional to your process's heap), but
the surrounding ext4 volume can grow if the workload wrote a lot during
its run.

For now, two practical workarounds:

- For transport, tar with `-S` so sparseness is preserved (a 2 GiB
  sparse image is typically well under 100 MiB on the wire):

  ```bash
  tar -czSf counter.snap.tar.gz counter.snap/
  ```

  Use `rsync -aS` instead of `scp -r` if you're going host-to-host —
  `scp` doesn't preserve sparseness.

- If you know the workload only writes a few hundred MB, pre-size the
  scratch disk down via `boot({ snapshot: "<smaller pre-allocated
file>" })` so the bundle starts smaller.

A `--compact` flag that trims unused blocks at snapshot time is on
the roadmap.
