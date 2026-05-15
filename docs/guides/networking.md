# Networking

You'll usually want two things from the network in a microVM: the guest
should be able to reach the outside world (download a package, hit an
API), and you should be able to reach into the guest from the host (curl
a server you're running in there). Both work out of the box with no
configuration — this guide covers what's happening, when it isn't
working, and how to extend it.

## Reaching the internet from inside the guest

This part is automatic. Boot any VM and the guest can already talk to
the internet:

```bash
npx machinen boot -- bash -c 'curl -s ifconfig.me; echo'
```

DNS, TCP, UDP all work. There's no NAT setup, no `iptables`, no virtual
bridge interface to configure — none of the usual VM networking
ceremony. Under the hood, the runtime spawns a small sidecar process
called [gvproxy](https://github.com/containers/gvisor-tap-vsock) that
acts as a userspace TCP/IP stack bridged over vsock. The guest sees a
normal NIC; gvproxy translates between that and your host's actual
network.

The first VM you boot may pause for a second or two and print a single
line:

```
machinen: installing gvproxy v0.8.6 …
```

That's gvproxy being downloaded into `~/.machinen/gvproxy/` for the
first time. Subsequent boots use the cached binary and start silently.

If gvproxy can't be installed — you're offline, the Github release
fetch failed for some other reason — the runtime falls back gracefully:
networking stays disabled and `boot()` continues. Your VM still boots
and runs; it just can't reach the network. `curl` from inside will
hang or fail, which is your hint that gvproxy didn't come up. Re-run
the boot once you're back online, or pre-install gvproxy yourself
(see [Custom gvproxy](#custom-gvproxy) below).

## Reaching into the guest from the host

If your VM is running a server — an HTTP API on port 3000, a Postgres
on 5432, anything that listens — and you want to connect to it from
your host, forward a port:

```bash
npx machinen boot -p 3000:3000 -- bash -c 'python3 -m http.server 3000'
```

In another shell:

```bash
curl localhost:3000
```

The format is `<hostPort>:<guestPort>` — same as Docker. You can pass
`-p` multiple times for multiple ports.

By default, host ports bind to `127.0.0.1` only — localhost on your
machine, not reachable from elsewhere on your network. If you actually
want the port exposed on every interface (because you're testing across
machines, or running on a dev server you reach over the network), say
so explicitly. From Node, this is the `hostAddr` field:

```ts
await boot({
  image,
  cmd,
  portForward: [
    { hostPort: 3000, guestPort: 3000 }, // localhost only
    { hostPort: 5432, guestPort: 5432, hostAddr: "0.0.0.0" }, // all interfaces
  ],
});
```

If something on your host is already listening on the host port you
asked for, `boot()` will throw `BOOT_PORT_FORWARD_IN_USE` rather than
silently fail. Same for two forwards in the same boot trying to claim
the same host port (`BOOT_PORT_FORWARD_CONFLICT`).

## Reaching into a running VM without forwarding a port

There's a second way to reach into the guest that doesn't go through
the network at all. `machinen exec` runs a command inside a VM over
vsock — directly into the guest, bypassing TCP entirely:

```bash
npx machinen exec worker -- curl -s localhost:3000
```

The guest runs the curl, and `localhost:3000` resolves to the guest's
own loopback. From the host you see the response on stdout. Useful
when:

- You don't want to expose a port on the host but you need to poke at
  a service in the guest (testing, debugging, health checks).
- You're forking a VM. The fork doesn't inherit port forwards, so
  `exec` is the easiest way to reach it.

For interactive use (a real terminal, full-screen TUIs), `machinen
attach` is the right tool — same vsock channel, but with a PTY.

## Detached boots with mounts and port forwards

`--detached` composes with `--mount`, `--mount-live`, and `-p`. The
helpers that need to outlive the parent — gvproxy and the live-mount
FUSE servers — spawn as standalone daemons wrapped through
`pdeathsig --watch-pid <vmm>`, so they track the VMM's lifetime and
exit when it does. `--mount` (copy-once squashfs + ext4 overlay) needs
no runtime relay at all: both files are fd-passed to the VMM at spawn,
so the supervisor holds no live state afterwards.

Helper pids live in the registry alongside the VMM's, so
`machinen stop` reaps them on shutdown and `machinen ls` surfaces the
full set under a single name. `boot --detached -p ...`,
`boot --detached --mount-live ...`, and `fork --detach ...` with any
combination of these flags all work today.

## Custom gvproxy

The pinned gvproxy release that ships in `@machinen/vmm-*` is the right
choice for almost everyone. If you need to override it — local
development of gvproxy itself, an airgapped install where the Github
fetch isn't an option, a custom build with extra logging — point at
your binary with an env var:

```bash
export MACHINEN_GVPROXY=/path/to/gvproxy
```

Resolution order, in case you want to know which copy is being picked
up: `$MACHINEN_GVPROXY` first, then the sibling shipped alongside the
VMM binary, then `~/.machinen/gvproxy/<version>/gvproxy`, then
`gvproxy` on `$PATH`, then a fresh download.
