# examples/quickstart

Runnable companion to the [quickstart in the top-level README](../../README.md#quickstart).
Builds a Node HTTP server that counts requests in memory, boots it in
a microVM, snapshots the running process, and restores it.

The point of the demo: the counter only lives in the Node process's
heap. After a snapshot/restore round-trip the next request still
returns `{ count: N+1 }` — same heap, same TCP listener, same process,
different VM.

## 1. Bake the image

```sh
pnpm install
pnpm start
```

`bake.ts` calls `provision({ install })`, which boots the base Debian
rootfs, runs `apt-get install nodejs` inside, drops `counter.mjs` at
`/opt/counter.mjs`, and archives the result to
`./artifacts/rootfs.tar.gz`. First run takes a couple of minutes; the
bake script is a no-op after that.

## 2. Boot it and give it state

```sh
npx machinen boot --name counter -p 3000:3000 --detach ./artifacts/rootfs.tar.gz
curl localhost:3000     # { "count": 1 }
curl localhost:3000     # { "count": 2 }
```

`--name counter` registers the VM under a stable handle. `-p 3000:3000`
forwards the host port to the guest. `--detach` returns once the guest
is up instead of holding the terminal.

## 3. Snapshot and restore

```sh
npx machinen snapshot counter ./artifacts/snapshot
npx machinen restore ./artifacts/snapshot -p 3000:3000 --detach
curl localhost:3000     # { "count": 3 }
```

The third `curl` returns `{ count: 3 }` because the Node process picked
up exactly where it left off — same heap, same listening socket. To
move it to another host instead, `scp -r ./artifacts/snapshot host-b:`
and run the restore there. Host architectures have to match (arm64 to
arm64).

## Files

- `counter.mjs` — the trivial HTTP server. Gets copied into the rootfs
  during the bake.
- `bake.ts` — the `provision()` call that produces the rootfs tarball.
- `artifacts/rootfs.tar.gz` — the baked rootfs (gitignored, ~100 MiB).
- `artifacts/snapshot/` — written by `machinen snapshot` (gitignored).
