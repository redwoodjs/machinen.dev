// Fork demo for examples/fork-pi.
//
//   pnpm -F @machinen/example-fork-pi start
//
// Boots a source VM with the host's ~/.pi/agent mounted at
// /root/.pi/agent (copy-once, so the OAuth state baked in by
// `pi /login` rides into the snapshot). Snapshots the source, then
// restores three parallel siblings — each one runs `pi -p` with a
// different prompt via the vsock exec agent and reports back. Three
// independent answers from one warm snapshot.
//
// Prereq: run `pi` once on the host and `/login` so `~/.pi/agent/`
// holds a working session — see ./README.md.

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { boot, restore } from "@machinen/runtime";

const here = dirname(new URL(import.meta.url).pathname);
const artifactsDir = resolve(here, "artifacts");
const rootfsPath = resolve(artifactsDir, "rootfs.tar.gz");
const snapshotDir = resolve(artifactsDir, "snapshot");

if (!existsSync(rootfsPath)) {
  process.stderr.write(`run: ${rootfsPath} missing — run \`pnpm bake\` first\n`);
  process.exit(1);
}

const piAgentHost = resolve(homedir(), ".pi/agent");
if (!existsSync(piAgentHost)) {
  process.stderr.write(
    `run: ${piAgentHost} not found.\n` +
      "     Install pi (npm i -g @earendil-works/pi-coding-agent),\n" +
      "     run `pi`, /login, then re-run this script.\n",
  );
  process.exit(1);
}

// Dev-checkout asset wiring; same pattern as scripts/smoke-tests.sh.
// A published install resolves these itself.
const assetsDir = process.env.MACHINEN_ASSETS_DIR;
const kernel = assetsDir ? join(assetsDir, "Image-arm64") : undefined;
const dtb = assetsDir ? join(assetsDir, "virt-arm64.dtb") : undefined;

// vm.snapshot() refuses to overwrite an existing bundle, so wipe.
if (existsSync(snapshotDir)) {
  rmSync(snapshotDir, { recursive: true, force: true });
}
mkdirSync(artifactsDir, { recursive: true });

process.stderr.write("boot: source VM (creds mounted from ~/.pi/agent)\n");
const source = await boot({
  image: rootfsPath,
  kernel,
  dtb,
  mount: { host: piAgentHost, guest: "/root/.pi/agent" },
  timeoutMs: null,
});

process.stderr.write("snapshot: dumping source\n");
const snap = await source.snapshot({ outDir: snapshotDir });
process.stderr.write(`snapshot: bundle at ${snap.snapDir} (${Math.round(snap.elapsedMs)}ms)\n`);

const tasks = [
  { lang: "rust", prompt: "Write fizzbuzz in Rust. Code only, no commentary." },
  { lang: "python", prompt: "Write fizzbuzz in Python. Code only, no commentary." },
  { lang: "go", prompt: "Write fizzbuzz in Go. Code only, no commentary." },
];

process.stderr.write(`fork: restoring ${tasks.length} siblings in parallel\n`);
const t0 = Date.now();
const results = await Promise.all(
  tasks.map(async ({ lang, prompt }) => {
    const vm = await restore({
      snapDir: snapshotDir,
      image: rootfsPath,
      kernel,
      dtb,
      name: `pi-${lang}`,
    });
    const tFork = Date.now();
    process.stderr.write(`[${lang}] restored in ${tFork - t0}ms, asking pi\n`);
    try {
      // pi reads ~/.pi/agent — HOME=/root makes that resolve. Single-
      // quote the prompt; the prompts in `tasks` contain no quotes.
      const res = await vm.exec(`HOME=/root pi -p '${prompt}'`, {
        execTimeoutMs: 180_000,
      });
      return { lang, stdout: res.stdout, stderr: res.stderr, exitCode: res.exitCode };
    } finally {
      await vm.kill();
    }
  }),
);

for (const { lang, stdout, stderr, exitCode } of results) {
  process.stdout.write(`\n=== ${lang} (exit ${exitCode}) ===\n${stdout}\n`);
  if (stderr.trim()) {
    process.stderr.write(`[${lang}] stderr:\n${stderr}\n`);
  }
}
