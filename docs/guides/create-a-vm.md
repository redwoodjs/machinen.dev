# Create a VM

This guide is about the trade-off between _getting started fast_ and
_having something reusable_. There are three points on that line, and which
one's right depends on what you're doing right now.

## "I just want a Linux shell"

If you only need to poke at something — try a command, see what's installed
in the base image, debug an apt issue — boot the cached Debian rootfs
directly and pass the command after `--`:

```bash
npx machinen boot -- /bin/sh
```

Want curl? Install it on the spot. The VM is throwaway anyway:

```bash
npx machinen boot -- bash -lc 'apt-get update && apt-get install -y curl && curl ifconfig.me'
```

The VM exits when your command exits. Nothing is registered, nothing is
named, nothing persists. This is the right mode for one-off exploration
and quick checks.

The catch: every boot starts from the bare base, so anything you install
this way is gone when the command returns. If you find yourself running
the same `apt install` three boots in a row, you want the next mode.

## "I have an app I want to run repeatedly"

Bake an image once, boot it many times. `provision()` runs your install
steps inside a real VM and archives the result as a tarball.

```ts
// bake.ts
import { readFileSync } from "node:fs";
import { provision } from "@machinen/runtime";

await provision({
  install: async (vm) => {
    await vm.exec("apt-get update && apt-get install -y nodejs");
    await vm.writeFile("/opt/server.js", readFileSync("./server.js"));
  },
  cmd: ["/usr/bin/node", "/opt/server.js"],
  env: { NODE_ENV: "production" },
  out: "./my-server.tar.gz",
});
```

`cmd` and `env` get baked into the image as defaults — when someone runs
`npx machinen boot ./my-server.tar.gz` with no arguments, your server
starts. They're defaults, not requirements: pass `-- bash` to drop into a
shell instead, or `--env LOG_LEVEL=debug` to override an env var.

This is the right mode whenever the install steps are non-trivial or
slow. Re-running `apt install nodejs` on every boot is a waste; baking it
into the image once and reusing the result is what `provision()` is for.

## "I want this VM to stick around so I can come back to it"

The first two modes give you anonymous VMs that exit when their command
exits. If you want to leave the VM running and reach it again from
another shell — or from another process entirely — give it a name and
detach:

```bash
npx machinen boot --name worker --detached ./my-server.tar.gz
```

`--detached` is the important flag here. Without it, the boot command
holds onto the VM's stdio and stays in the foreground. With it, the
command returns as soon as the guest produces its first console byte,
and the VM keeps running in the background.

Once it's running, you can find it again from any shell:

```bash
npx machinen ls                              # see PID, NAME, uptime, port forwards
npx machinen exec worker -- ps aux           # run a one-off command
npx machinen attach worker                   # interactive shell with job control
```

`exec` is for scripted use — pipes are line-buffered, the command runs
to completion, exit code propagates. `attach` is for when _you_ want a
real terminal: tab completion, full-screen TUIs, Ctrl-C signalling the
guest process and not the host CLI.

When you're done:

```bash
npx machinen stop worker
```

`stop` SIGTERMs the VMM and waits for it to exit cleanly; it falls back
to SIGKILL after 2 seconds if the guest hangs. It also cleans up the
registry entry and the gvproxy sidecar so host ports don't leak. If a
detached VM crashes without going through `stop`, run `npx machinen gc`
to clean up the leftover registry entry.

From Node, the equivalent of all this is `boot({ name, detached: true })`
followed by `attach({ name })` from any process — the registry is just a
directory under `~/.machinen/vms/` that any process can read.

## A note on names

Names can be path-shaped: `tests/integration/db-7` is a valid name, and
it's how forks get auto-named (`<source>/<pid>`) so you can see lineage
in `machinen ls`. Names have to be unique while the VM is live — boot
will fail with `REGISTRY_NAME_IN_USE` if you reuse a name that's already
taken.
