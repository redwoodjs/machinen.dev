import { provision } from "@machinen/runtime";

await provision({
  install: async (vm) => {
    await vm.exec("apt-get update");
    await vm.exec("apt-get install -y --no-install-recommends curl ca-certificates unzip xz-utils");
    // Install Node 22 via fnm, then pi globally.
    await vm.exec(
      "curl -fsSL https://fnm.vercel.app/install | bash -s -- --install-dir /opt/fnm --skip-shell",
    );
    await vm.exec("FNM_DIR=/opt/fnm /opt/fnm/fnm install 22");
    await vm.exec("FNM_DIR=/opt/fnm /opt/fnm/fnm default 22");
    await vm.exec("ln -sf /opt/fnm/aliases/default/bin/* /usr/local/bin/");
    await vm.exec("npm install -g @earendil-works/pi-coding-agent");
    await vm.exec("ln -sf /opt/fnm/aliases/default/bin/* /usr/local/bin/");
  },
  cmd: ["/bin/sleep", "infinity"],
  out: "./artifacts/rootfs.tar.gz",
});
