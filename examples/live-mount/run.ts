import { existsSync } from "node:fs";
import { boot, provision } from "@machinen/runtime";

if (!existsSync("./artifacts/rootfs.tar.gz")) {
  await provision({
    install: async (vm) => {
      await vm.exec("apt-get update && apt-get install -y --no-install-recommends nodejs");
    },
    cmd: ["/usr/bin/node", "/mnt/shared/server.mjs"],
    out: "./artifacts/rootfs.tar.gz",
  });
}

const vm = await boot({
  image: "./artifacts/rootfs.tar.gz",
  liveMounts: [{ host: "./shared", guest: "/mnt/shared", mode: "rw" }],
  portForward: [{ hostPort: 8080, guestPort: 3000 }],
});

vm.stdout.pipe(process.stdout);
vm.stderr.pipe(process.stderr);
process.on("SIGINT", () => void vm.kill());
await vm.wait();
