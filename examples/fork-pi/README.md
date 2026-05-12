# examples/fork-pi

Boots [`pi`](https://pi.dev) (the terminal coding harness from
`@earendil-works/pi-coding-agent`) inside a microVM, snapshots the
warm VM, and forks it three ways. Each fork asks pi a different
question in parallel — three independent answers from one warm
snapshot.

The point of the demo: `restore()` × N from a single snapshot bundle
is significantly cheaper than booting N fresh VMs and reinstalling pi
inside each one. The snapshot already has Node 22 + pi globally
installed; restore just rehydrates the source's address space and the
sibling is immediately ready to run a `pi -p` query.

## Prereqs

Authenticate pi on the host so the OAuth state lives at
`~/.pi/agent/`:

```sh
npm install -g @earendil-works/pi-coding-agent
pi
/login    # pick your provider (Codex subscription, Anthropic Claude
          # Pro/Max, etc.) and complete OAuth in the browser
```

After `/login` succeeds, the bake step below mounts `~/.pi/agent/`
into the source VM (copy-once, into the snapshot's rootdisk), so
every fork inherits the same authenticated session.

## 1. Bake the image

```sh
pnpm install
pnpm bake
```

`bake.ts` boots the base Debian rootfs, installs Node 22 via
[`fnm`](https://github.com/Schniz/fnm) into `/opt/fnm`, runs
`npm install -g @earendil-works/pi-coding-agent`, symlinks the
toolchain into `/usr/local/bin`, and archives the result to
`./artifacts/rootfs.tar.gz`. First run takes a few minutes;
idempotent after that.

## 2. Run the fork demo

```sh
pnpm start
```

`run.ts` boots the source VM with `~/.pi/agent/` mounted in, calls
`source.snapshot({ outDir: ./artifacts/snapshot })`, then
`Promise.all`s three `restore()` calls. Each fork runs
`pi -p '<prompt>'` over the vsock exec agent and prints the result.

Expected output (truncated):

```
boot: source VM (creds mounted from ~/.pi/agent)
snapshot: bundle at .../artifacts/snapshot (1834ms)
fork: restoring 3 siblings in parallel
[rust] restored in 412ms, asking pi
[python] restored in 415ms, asking pi
[go] restored in 419ms, asking pi

=== rust (exit 0) ===
fn main() {
    for i in 1..=100 {
        ...
    }
}

=== python (exit 0) ===
for i in range(1, 101):
    ...
```

## Files

- `bake.ts` — `provision()` call that installs Node + pi into the
  base rootfs.
- `run.ts` — boots the source, snapshots, fans out three restores.
- `artifacts/rootfs.tar.gz` — baked rootfs (gitignored, ~200 MiB).
- `artifacts/snapshot/` — snapshot bundle (gitignored).

## Tradeoffs and design notes

**The snapshot contains your pi OAuth state.** `~/.pi/agent/` is
copy-once-mounted into the source VM before snapshot, so the OAuth
tokens end up inside `./artifacts/snapshot/`. Same threat model as
`docker save` on an image you'd run `docker exec` secrets into:
fine on your own disk (which is gitignored), risky to move.

Three patterns if you want a different threat model:

- **Same-host only?** Swap `mount` for `liveMounts: [{ host:
piAgentHost, guest: "/root/.pi/agent", mode: "rw" }]`. The bundle
  then records only the host path, not the token bytes. Snapshot
  becomes worthless on another machine (which is the point).
- **Move bundles between hosts?** Encrypt the tarball at the
  transport boundary: `tar -cf - ./artifacts/snapshot | age -r
<pubkey> > snapshot.tar.age`. Machinen doesn't ship crypto for
  this; `age` / `gpg` already do the job.
- **Send-anywhere portable, secret out-of-band?** Drop the mount
  entirely, switch pi to API-key auth, and push
  `ANTHROPIC_API_KEY` per fork via `VsockSecrets.send()` _after_
  restore. The bundle contains zero credentials; each restoring
  host supplies its own key.

**Per-fork credentials.** All three forks share the same Codex
session. The third pattern above is also the answer if you want
each fork to run as a different identity (e.g. tenant isolation).

**Cold pi in each fork.** This example snapshots before pi has ever
run, so every fork pays pi's Node startup cost (~hundreds of ms).
The more dramatic version snapshots **mid-conversation** — boot pi,
seed a system prompt + initial turn, snapshot while pi is idle
waiting for the next user message, then have each fork send a
different next message. That needs a longer-lived pi process driven
via stdin or RPC mode; left as an exercise.

## The CLI equivalent

Once `./artifacts/rootfs.tar.gz` exists, the same flow via
`machinen`:

```sh
# 1. Boot source with creds mounted (run in one terminal):
machinen boot --name pi-source \
  --mount ~/.pi/agent:/root/.pi/agent \
  ./artifacts/rootfs.tar.gz

# 2. From another terminal — snapshot it:
machinen snapshot pi-source ./artifacts/snapshot

# 3. Fork three siblings:
machinen restore ./artifacts/snapshot --name pi-rust --detach
machinen restore ./artifacts/snapshot --name pi-python --detach
machinen restore ./artifacts/snapshot --name pi-go --detach

# 4. Drive each one:
machinen exec pi-rust   -- pi -p "Write fizzbuzz in Rust"
machinen exec pi-python -- pi -p "Write fizzbuzz in Python"
machinen exec pi-go     -- pi -p "Write fizzbuzz in Go"

# 5. Clean up:
machinen stop pi-rust pi-python pi-go pi-source
```
