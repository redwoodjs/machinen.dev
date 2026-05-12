# quickstart

Bake a Node HTTP counter into a microVM, boot it, snapshot the running
process, restore it.

## 1. Bake

```sh
pnpm install
node --import tsx bake.ts
```

Writes `./artifacts/rootfs.tar.gz`.

## 2. Boot

```sh
npx machinen boot --name counter -p 3000:3000 --detach ./artifacts/rootfs.tar.gz
curl localhost:3000   # { "count": 1 }
curl localhost:3000   # { "count": 2 }
```

## 3. Snapshot and restore

```sh
npx machinen snapshot counter ./artifacts/snapshot
npx machinen restore ./artifacts/snapshot -p 3000:3000 --detach
curl localhost:3000   # { "count": 3 }
```

Same Node process, same heap, same listening socket — just running
in a new VM.
