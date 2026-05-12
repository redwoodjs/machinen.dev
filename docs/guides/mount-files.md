# Mount files into a VM

You'll usually want files from the host inside the guest — config the VM
needs to read, source code you're working on, fixtures for a test, an
output directory to write into. There are three ways to get them across,
and the right one depends on what you're sharing and how much it changes.

A quick decision sketch before the details:

- **One small file?** `vm.writeFile()` from your host code. No mount
  needed.
- **A directory the guest only reads, set in stone at boot time?**
  `--mount`. The data rides into the VM at boot and the guest sees a
  copy.
- **A directory you want the guest and host to share live**, with
  changes flowing in either direction? `--mount-live`. It's a FUSE
  pass-through — no copy, just a vsock pipe back to the host.

## A workspace you're actively editing — `--mount-live`

This is the most common case for development. You're editing files on
your host, and you want the guest to see the changes as you save them
(no rebuild, no re-bake, no re-boot). You also want anything the guest
writes — build outputs, logs, generated files — to land on the host
filesystem so you can keep working with them.

```bash
npx machinen boot --mount-live ./workspace:/mnt/workspace -- bash
```

In the guest, `/mnt/workspace` is your host's `./workspace` directory.
Reads stream over vsock on demand — nothing was copied at boot, so the
mount is essentially free even if the workspace is huge. Writes land
back on the host immediately. If the guest builds a binary into
`./workspace/dist/`, you'll see it in your editor.

Default mode is read-write. If you want to share something the guest
mustn't be able to modify — a directory of test fixtures, say, or a
read-only data dump — pass `:ro`:

```bash
npx machinen boot --mount-live ./fixtures:/mnt/fixtures:ro -- ./run-tests.sh
```

You can pass `--mount-live` multiple times for separate shares; each
one gets its own vsock port:

```bash
npx machinen boot \
  --mount-live ./src:/mnt/src \
  --mount-live ./fixtures:/mnt/fixtures:ro \
  -- bash
```

A security note worth being aware of: a `rw` live mount is a
persistent channel from inside the guest back to the host filesystem,
rooted at whatever directory you shared. If you're running untrusted
code in the VM, this matters — a compromised process inside the guest
can write anywhere under `./workspace` while the VM is up. The exposure
is bounded to the share root (containment doesn't let it escape upward),
but inside that root you've effectively given the guest full write
access. For untrusted inputs that don't need write-through, use the
`:ro` mode, or use `--mount` instead.

From Node:

```ts
await boot({
  image,
  cmd,
  liveMounts: [
    { host: "./workspace", guest: "/mnt/workspace", mode: "rw" },
    { host: "./fixtures", guest: "/mnt/fixtures", mode: "ro" },
  ],
});
```

## A directory the guest only needs at boot — `--mount`

If the guest will read the directory once at startup and never look
again — input data for a one-shot job, model weights for a fresh
serving process — `--mount` ships a copy of the directory into the VM
at boot. After that, it's just files inside the rootfs; the host has
no further involvement.

```bash
npx machinen boot --mount ./input-data:/mnt/input -- ./process.sh
```

Two important consequences of "it's a copy":

- **Changes you make on the host after boot don't propagate.** If
  you're editing files mid-run, this isn't the right tool — use
  `--mount-live`.
- **Anything the guest writes to the mount is discarded when the VM
  exits.** The mount is part of the guest's ephemeral filesystem.

This mode trades flexibility for simplicity and isolation: there's no
ongoing connection to the host, so a compromised guest can't reach
back. For inputs you don't need write-through on, this is strictly
safer than `--mount-live`.

There's one performance footnote. The mount payload travels through
the initramfs cpio at boot, which means it briefly counts against the
RAM ceiling at unpack time. For a few hundred MB this is fine. For
mounts measured in gigabytes, prefer `--mount-live` even if you don't
need write-through — it doesn't pay the boot-time copy.

```ts
await boot({
  image,
  cmd,
  mount: { host: "./input-data", guest: "/mnt/input" },
});
```

A naming rule for both `--mount` and `--mount-live`: the guest path
must be under `/mnt/`. This is a deliberate constraint — keeping all
host-shared paths in one place makes it obvious to anyone reading code
in the guest where data is coming from.

## A single file — `vm.writeFile()`

If all you need is to drop one file into the guest — a config, a small
script, a license blob — you don't need a mount at all:

```ts
await vm.writeFile("/etc/myapp/config.json", JSON.stringify(cfg));
await vm.writeFile("/usr/local/bin/run.sh", scriptSource, { mode: 0o755 });
await vm.writeFile("/var/log/audit.log", line, { append: true });
```

The contents ride through a single vsock exec frame and land at the
target path. Parent directories are created automatically. It's
binary-safe (base64 under the hood). Set `mode` to make it executable;
set `append: true` to add to an existing file.

This is the right tool for small-to-medium files — configs, scripts,
seed data measured in kilobytes or low megabytes. For very large blobs,
the mount paths above are more efficient.

## Landing the workload inside the share

A small ergonomic note: you'll often want the guest's entrypoint to
run _inside_ the directory you mounted, instead of starting in `/` and
needing a `cd` in your wrapper script. Pass `--cwd` to set the guest's
working directory:

```bash
npx machinen boot --mount-live ./workspace:/mnt/workspace \
  --cwd /mnt/workspace -- bash
```

Now the shell starts in `/mnt/workspace`. The same flag works for any
guest entrypoint, not just bash.

From Node, the equivalent is `boot({ guestCwd: "/mnt/workspace" })`.
