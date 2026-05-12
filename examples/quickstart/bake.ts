// Step 1 of docs/quickstart.md — bake a Node + counter.mjs image.
//
//   pnpm -F @machinen/example-quickstart start
//
// Boots the base Debian rootfs, installs nodejs into it, drops
// counter.mjs at /opt/counter.mjs, and writes the archived rootfs to
// ./artifacts/rootfs.tar.gz. Idempotent: if the rootfs already exists
// this is a no-op.

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { provision } from "@machinen/runtime";

const here = dirname(new URL(import.meta.url).pathname);
const artifactsDir = resolve(here, "artifacts");
const rootfsPath = resolve(artifactsDir, "rootfs.tar.gz");
const counterPath = resolve(here, "counter.mjs");

if (existsSync(rootfsPath)) {
  process.stderr.write(`bake: ${rootfsPath} already exists, skipping\n`);
  process.exit(0);
}

mkdirSync(artifactsDir, { recursive: true });

process.stderr.write("bake: installing nodejs into base rootfs (first run)\n");

const result = await provision({
  install: async (vm) => {
    await vm.exec("apt-get update && apt-get install -y nodejs");
    await vm.writeFile("/opt/counter.mjs", readFileSync(counterPath));
  },
  cmd: ["/usr/bin/node", "/opt/counter.mjs"],
  out: rootfsPath,
});

process.stderr.write(
  `bake: done in ${Math.round(result.elapsedMs / 1000)}s ` +
    `(${Math.round(result.sizeBytes / 1024 / 1024)} MiB) → ${rootfsPath}\n`,
);
