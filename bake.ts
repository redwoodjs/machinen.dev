import { provision } from "@machinen/runtime";

await provision({
  install: async (vm) => {
    await vm.exec(
      "apt-get update && " +
        "apt-get install -y --no-install-recommends " +
        "ca-certificates curl git nodejs npm && " +
        "rm -rf /var/lib/apt/lists/*",
    );
  },
  cmd: ["/bin/sleep", "infinity"],
  out: "./rootfs.tar.gz",
});

console.log("baked ./rootfs.tar.gz");
