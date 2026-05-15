# Hand off a running VM

A **handoff** moves a running VM from one host to another without
restarting the workload.

Machinen does not make handoff a special service. It is just composed
from the normal primitives:

1. snapshot a named VM,
2. transfer the snapshot bundle and image, and
3. restore on the target host.

Build that flow with SSH, rsync, object storage, a queue, CI, Node, or a
custom UI. The runtime is the same either way.

## What the snapshot carries

The snapshot carries the VM state: memory, device state, guest disk
writes, open file descriptors, and guest-side listeners.

These host-local pieces must be supplied again on the target:

- **Image tarball:** copy the source image to the same path, or pass
  `--image <tar.gz>` to `restore`.
- **Port forwards:** re-declare them with `-p`; host ports are not
  inherited.
- **Live mounts:** restore keeps the same guest mount paths. If a target
  host path differs, remap only the host side with
  `--mount-live <new-host>:<recorded-guest-path>[:mode]`.
- **Architecture:** source and target must match, for example arm64 to
  arm64.

## Minimal SSH handoff

Start with a named VM:

```bash
npx machinen boot --name counter -p 3000:3000 --detached ./counter.tar.gz
```

Move it to `host-b`:

```bash
REMOTE=.machinen/handoffs/counter

# Snapshot stops the source by default. That makes this a true handoff.
npx machinen snapshot counter ./counter.snap

ssh host-b "mkdir -p $REMOTE"
rsync -aS ./counter.snap/ host-b:$REMOTE/counter.snap/
rsync -a ./counter.tar.gz host-b:$REMOTE/counter.tar.gz

ssh host-b \
  "npx machinen restore $REMOTE/counter.snap \
     --image $REMOTE/counter.tar.gz \
     --name counter \
     -p 3000:3000"
```

Use `rsync -aS` for snapshots so sparse files stay sparse. `scp` is fine
for small demos, but can make sparse files much larger.

Pass `--keep-alive` to `snapshot` only when the source should keep
running. That is a copy/fork workflow, not a strict handoff.

## Build your own handoff

A handoff tool only needs to automate the same contract:

1. Pick a source VM from `machinen ls --json`.
2. Check the target: SSH works, `machinen install` has run, and
   `uname -m` matches the source.
3. Run `machinen snapshot <name> <bundle>`.
4. Transfer the bundle and source image.
5. Run `machinen restore <bundle> --image <image>` on the target, plus
   the target's `-p` forwards and any live-mount overrides.
6. Show the new host and port to the user.

From TypeScript, the local snapshot step can use the runtime API:

```ts
import { attach } from "@machinen/runtime";

const vm = await attach({ name: "counter" });
await vm.snapshot({ outDir: "./counter.snap" });
```
