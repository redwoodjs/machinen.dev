// Bake step for examples/fork-pi.
//
//   pnpm -F @machinen/example-fork-pi bake
//
// Boots the base Debian rootfs, installs Node 22 via fnm, then
// `npm install -g @earendil-works/pi-coding-agent` so the `pi` binary
// is on PATH. The default cmd is `sleep infinity` — the source VM
// just sits idle so each fork can drive its own one-shot `pi -p` from
// outside via `vm.exec()`. No credentials are baked in; auth comes
// from the host's `~/.pi/agent/` mounted at boot in run.ts.
//
// Output: ./artifacts/rootfs.tar.gz. Idempotent: skips if it exists.

import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { provision } from "@machinen/runtime";

const here = dirname(new URL(import.meta.url).pathname);
const artifactsDir = resolve(here, "artifacts");
const rootfsPath = resolve(artifactsDir, "rootfs.tar.gz");

if (existsSync(rootfsPath)) {
  process.stderr.write(`bake: ${rootfsPath} already exists, skipping\n`);
  process.exit(0);
}

mkdirSync(artifactsDir, { recursive: true });

process.stderr.write("bake: installing node 22 + pi into base rootfs (first run)\n");

const result = await provision({
  install: async (vm) => {
    await vm.exec("apt-get update");
    // curl + ca-certificates for the fnm install script;
    // unzip extracts the fnm release archive; xz-utils unpacks the
    // node tarball fnm downloads.
    await vm.exec("apt-get install -y --no-install-recommends curl ca-certificates unzip xz-utils");
    // fnm installs to --install-dir; --skip-shell stops it from
    // editing .bashrc (we don't have an interactive shell anyway).
    // FNM_DIR keeps node versions + aliases under /opt/fnm so the
    // whole toolchain lives in one tidy tree.
    await vm.exec(
      "curl -fsSL https://fnm.vercel.app/install | bash -s -- --install-dir /opt/fnm --skip-shell",
    );
    await vm.exec("FNM_DIR=/opt/fnm /opt/fnm/fnm install 22");
    await vm.exec("FNM_DIR=/opt/fnm /opt/fnm/fnm default 22");
    // Expose node/npm/npx on the system PATH before the global install
    // so npm's `#!/usr/bin/env node` shebang resolves. Also lets
    // `vm.exec("pi -p ...")` in run.ts work without shell hooks.
    await vm.exec("ln -sf /opt/fnm/aliases/default/bin/* /usr/local/bin/");
    await vm.exec("npm install -g @earendil-works/pi-coding-agent");
    // Re-link so the freshly installed `pi` symlink also lands in
    // /usr/local/bin.
    await vm.exec("ln -sf /opt/fnm/aliases/default/bin/* /usr/local/bin/");
  },
  cmd: ["/bin/sleep", "infinity"],
  out: rootfsPath,
});

process.stderr.write(
  `bake: done in ${Math.round(result.elapsedMs / 1000)}s ` +
    `(${Math.round(result.sizeBytes / 1024 / 1024)} MiB) → ${rootfsPath}\n`,
);
