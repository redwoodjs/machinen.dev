import { existsSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { boot, restore } from "@machinen/runtime";

const piAgentHost = resolve(homedir(), ".pi/agent");
if (!existsSync(piAgentHost)) {
  console.error(
    `${piAgentHost} not found. Install pi (npm i -g @earendil-works/pi-coding-agent), run \`pi\`, /login, then re-run.`,
  );
  process.exit(1);
}

rmSync("./snapshot", { recursive: true, force: true });

const source = await boot({
  image: "./rootfs.tar.gz",
  mount: { host: piAgentHost, guest: "/root/.pi/agent" },
});

await source.snapshot({ outDir: "./snapshot" });

const tasks = [
  { lang: "rust", prompt: "Write fizzbuzz in Rust. Code only." },
  { lang: "python", prompt: "Write fizzbuzz in Python. Code only." },
  { lang: "go", prompt: "Write fizzbuzz in Go. Code only." },
];

const results = await Promise.all(
  tasks.map(async ({ lang, prompt }) => {
    const vm = await restore({
      snapDir: "./snapshot",
      image: "./rootfs.tar.gz",
      name: `pi-${lang}`,
    });
    try {
      const res = await vm.exec(`HOME=/root pi -p '${prompt}'`, {
        execTimeoutMs: 180_000,
      });
      return { lang, stdout: res.stdout };
    } finally {
      await vm.kill();
    }
  }),
);

for (const { lang, stdout } of results) {
  console.log(`\n=== ${lang} ===\n${stdout}`);
}
