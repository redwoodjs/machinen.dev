# 0003 — Remove the FUSE-over-vsock live-mount transport

[ADR 0002](0002-virtio-fs-live-mount-transport-embedded-in-vmm.md) (#332) added an in-VMM **virtio-fs** transport for **Live mount** and made it the default, leaving FUSE-over-vsock as an explicit `protocol: "fuse"` fallback. #338 removes that fallback entirely: virtio-fs is now the only live-mount transport. The shared FUSE opcode handlers — the transport-agnostic `fuse.zig` module — stay; they are the virtio-fs device's handlers. Everything that existed _only_ to carry those handlers over vsock is gone.

## What was removed

- **The standalone mount-server process.** `packages/mount-server/src/main.zig` (the vsock/UDS transport shim) and its `machinen-mount-server` build target. The `fuse` module (`fuse.zig`) is the only thing left in `@machinen/mount-server`; `packages/microvm/src/virtiofs.zig` imports it.
- **The guest byte-pump.** `packages/microvm/assets/fuse-agent.zig` and the `build-base-assets.sh` step that built and staged it into the rootfs.
- **The vsock mount channel.** `spawnDetachedMountServer`, `mount-server-detached.ts`, the per-mount `MACHINEN_VSOCK` `out:` entries, the `liveMountServers` bookkeeping in `boot.ts` and the **Registry**, and the snapshot stop/respawn hooks for those servers.
- **`/init`'s `.fuse` branch.** `startFuseAgent`, the `/etc/machinen-livemounts` TSV the CRIU shell scripts read, and `machinen-remount.sh`. `/init` now only runs `mount -t virtiofs`.
- **The `protocol` knob.** `liveMount({ protocol })` and the `--mount-live …:<protocol>` modifier are gone — with one transport they were meaningless. `ResolvedLiveMount` collapses from a discriminated union back to a single shape.
- **Packaging + CI.** The mount-server binary drops out of `@machinen/native-arm64-{darwin,linux}`; the `build-mount-server` release job and the asset-freshness checks for it are gone.

## Multiple live mounts — the gating decision

#332 wired a **single** virtio-fs device slot, so only one `--mount-live` per VM could use virtio-fs; additional mounts fell back to fuse. Removing fuse forced the choice between accepting one live mount per VM or wiring multiple slots. We **wired multiple slots**: the VMM (`boot_hvf.zig` / `boot_kvm.zig` / `virt.dts`) now declares **five** virtio-fs device slots (7..11), one device per `--mount-live`, parameterised the same way the virtio-blk slots are. The runtime caps `liveMounts` at five and rejects more with a clear error. Five rather than four because a `restore({ lazy: true })` appends one internal live mount (the page-image source) — four user mounts plus the lazy-restore mount fit.

The VMM learns the per-slot tag/mode/host-path from numbered env vars (`MACHINEN_VIRTIOFS_0..4`) — numbered rather than one comma-joined value so a host path can contain any byte.

## Snapshot / restore

FUSE-over-vsock needed an unmount-before-dump / respawn-and-remount dance because a live FUSE connection isn't cleanly CRIU-dumpable. The in-VMM virtio-fs device has no such problem: it's emulated by the **VMM**, which survives the CRIU dump, so the guest's mount view persists across `vm.snapshot({ leaveRunning: true })` and `vm.fork()` with no window. `machinen-dump-preflight.sh` loses its `unmount_live_mounts` step; the snapshot/restore paths no longer reason about a transport at all.

## Trade-offs

- **One fewer instrumentation signal.** The detached mount-server exposed a `bytesServedOnPagesImg` counter that `vm.memoryStats()` subtracted from `lazyPagesTotal` to derive `lazyPagesPending`. The in-VMM device writes no host-side stats, so `lazyPagesPending` now reports `lazyPagesTotal` directly (it no longer decreases as a lazy restore faults pages in). Acceptable: it was FUSE-over-vsock-only plumbing, and the headline `lazyPagesTotal` is unchanged.
- **Five mounts is a hard cap.** FUSE-over-vsock was unbounded (a vsock port per mount). Five covers the realistic workloads plus the lazy-restore internal mount; raising it is a one-line change in `MAX_VIRTIOFS_SLOTS` plus matching `virt.dts` nodes, at the cost of a little extra empty-slot probe time at boot.

Tracks #338; supersedes the fallback half of #332 / ADR 0002.
