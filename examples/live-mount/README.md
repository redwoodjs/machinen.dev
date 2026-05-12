# examples/live-mount

A microVM with a FUSE-backed live mount: the host's `./shared/`
directory appears inside the guest at `/mnt/shared`, and writes
propagate **both ways**, immediately, without re-baking or rebooting.

The guest runs a tiny HTTP server that reads `message.txt` on every
request and appends an entry to `access.log`. Edit `message.txt` on
the host and the next `curl` returns the new bytes. `tail` the log
on the host and watch the guest write to it in real time.

## Run it

```sh
pnpm install
pnpm start
```

First run takes a couple of minutes while `apt-get` installs nodejs
into the base rootfs (cached at `./.cache/` afterwards). From
another terminal:

```sh
# 1. Read the current message (host → guest direction):
curl http://localhost:8080/
# hello from the host

# 2. Edit on the host. The guest re-reads the file per request,
#    so the new content shows up immediately:
echo "edited live" > ./shared/message.txt
curl http://localhost:8080/
# edited live

# 3. Watch the guest write to the host filesystem:
tail -f ./shared/access.log
# 2026-05-11T19:42:11.103Z GET /
# 2026-05-11T19:42:14.671Z GET /
```

Hit Ctrl-C in the `pnpm start` terminal to stop the VM.

## What's happening

`run.ts` boots the cached image with:

```ts
const vm = await boot({
  image: imagePath,
  liveMounts: [{ host: sharedDir, guest: "/mnt/shared", mode: "rw" }],
  portForward: [{ hostPort: 8080, guestPort: 3000 }],
});
```

`liveMounts` opens a vsock FUSE channel: the guest's `/mnt/shared`
points at a vsock-mounted FUSE filesystem whose backend is the
host-side `mount-server` process serving bytes from `./shared/`. No
copy at boot, no rebuild on edit, no sync step.

`mode: "rw"` (the default) means the guest can write back through the
same channel. Try it from a shell:

```sh
# in the live-mount terminal hit Ctrl-C, then:
pnpm start &
machinen exec mount-server -- /bin/sh -c "echo guest-side >> /mnt/shared/scratch"
cat ./shared/scratch
# guest-side
```

Set `mode: "ro"` if you want the host to share read-only.

## Files

- `run.ts` — provision-then-boot driver.
- `shared/server.mjs` — the guest HTTP server. Lives on the host;
  the guest sees it via the live mount, so edits don't need a
  re-bake.
- `shared/message.txt` — what the server returns on each request.
- `shared/access.log` — written by the guest, visible on the host
  (gitignored).
- `.cache/node-image.tar.gz` — provisioned rootfs (gitignored).

## `mount` vs. `liveMounts`

`mount: { host, guest }` is a **copy-once** snapshot of the host dir
into the guest's rootdisk at boot. Faster (no FUSE channel), and the
copy survives `vm.snapshot()` because it lives in the image. But
edits don't propagate until the next boot.

`liveMounts: [{ host, guest, mode }]` is a **live FUSE window**. No
copy, edits propagate instantly, guest writes land on the host
(in `rw`). The tradeoff: the channel is held by a host-side process,
so a `vm.snapshot()` has to tear it down and re-establish on
restore — open fds across the dump see EBADF on next syscall. Fine
for stateless workloads; quiesce first for anything mid-write.

Use `mount` for "ship code into the VM, then forget about the host."
Use `liveMounts` for "iterate on the host, see results immediately
in the guest."

## The CLI equivalent

```sh
machinen boot ./.cache/node-image.tar.gz \
  --mount-live ./shared:/mnt/shared:rw \
  -p 8080:3000
```

No `-- <cmd>` needed — the image carries `node /mnt/shared/server.mjs`
as its default. The CLI's `--mount-live` flag is repeatable; each
entry maps one host dir to one guest dir under `/mnt/`.
