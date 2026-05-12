// Live-mount demo for examples/live-mount.
//
//   pnpm -F @machinen/example-live-mount start
//
// First run: provision() bakes a Node-capable rootfs to ./.cache/.
// Every run: boots that image with ./shared/ FUSE-mounted at
// /mnt/shared (mode rw), and forwards host :8080 → guest :3000. The
// guest's default cmd runs server.mjs out of the live mount, so
// edits to ./shared/server.mjs or ./shared/message.txt take effect
// without re-baking or rebooting.
//
// Verify from another terminal:
//
//   curl http://localhost:8080/                  # current message
//   echo "updated" > ./shared/message.txt        # edit live on host
//   curl http://localhost:8080/                  # guest re-reads it
//   tail -f ./shared/access.log                  # guest's writes

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { boot, provision } from "@machinen/runtime";

const here = dirname(new URL(import.meta.url).pathname);
const cacheDir = resolve(here, ".cache");
const imagePath = resolve(cacheDir, "node-image.tar.gz");
const sharedDir = resolve(here, "shared");

// Dev-checkout asset wiring; a published install resolves these
// itself. provision() resolves the base rootfs the same way.
const assetsDir = process.env.MACHINEN_ASSETS_DIR;
const kernel = assetsDir ? join(assetsDir, "Image-arm64") : undefined;
const dtb = assetsDir ? join(assetsDir, "virt-arm64.dtb") : undefined;

if (!existsSync(imagePath)) {
  process.stderr.write("provision: installing nodejs into base rootfs (first run)\n");
  mkdirSync(cacheDir, { recursive: true });
  const result = await provision({
    kernel,
    dtb,
    install: async (vm) => {
      await vm.exec("apt-get update");
      await vm.exec("apt-get install -y --no-install-recommends nodejs");
    },
    // Baked default cmd: runs server.mjs out of the live mount.
    cmd: ["/usr/bin/node", "/mnt/shared/server.mjs"],
    env: { NODE_NO_WARNINGS: "1" },
    out: imagePath,
  });
  process.stderr.write(
    `provision: done in ${Math.round(result.elapsedMs / 1000)}s ` +
      `(${Math.round(result.sizeBytes / 1024 / 1024)} MiB)\n`,
  );
}

const vm = await boot({
  image: imagePath,
  kernel,
  dtb,
  liveMounts: [{ host: sharedDir, guest: "/mnt/shared", mode: "rw" }],
  portForward: [{ hostPort: 8080, guestPort: 3000 }],
  timeoutMs: null,
});

vm.stdout.pipe(process.stdout);
vm.stderr.pipe(process.stderr);
process.on("SIGINT", () => void vm.kill());
process.on("SIGTERM", () => void vm.kill());

process.stderr.write(
  "boot: VM up. try:\n" +
    "  curl http://localhost:8080/\n" +
    "  echo 'updated' > ./shared/message.txt && curl http://localhost:8080/\n" +
    "  tail -f ./shared/access.log\n",
);
await vm.wait();
