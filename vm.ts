import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const IMAGE = join(ROOT, "rootfs.tar.gz");
const GUEST_WORKSPACE = "/mnt/workspace";
const GUEST_PORT = 3000;

type VmEntry = {
  name: string;
  ports: { hostPort: number; guestPort: number }[];
};

function listVms(): VmEntry[] {
  const r = spawnSync("machinen", ["ls", "--json"], { encoding: "utf8" });
  if ((r.status ?? 1) !== 0 || !r.stdout.trim()) return [];
  try {
    const data = JSON.parse(r.stdout);
    return Array.isArray(data.vms) ? data.vms : [];
  } catch {
    return [];
  }
}

function pickName(taken: Set<string>): string {
  for (let i = 1; i < 10_000; i++) {
    const candidate = `machinen-dev-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("ran out of machinen-dev-{n} names");
}

function pickPort(taken: Set<number>, start = 3001): number {
  for (let p = start; p < 65535; p++) {
    if (!taken.has(p)) return p;
  }
  throw new Error("no free host port");
}

function ensureImage(): void {
  if (existsSync(IMAGE)) return;
  console.error("rootfs.tar.gz not found — running bake first…");
  const r = spawnSync("node", [join(ROOT, "bake.ts")], { stdio: "inherit" });
  if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1);
}

function ensureWorkspace(name: string): string {
  const ws = join(homedir(), ".machinen", "workspaces", name);
  mkdirSync(ws, { recursive: true });
  return ws;
}

function boot(name: string, hostPort: number, workspace: string): void {
  const args = [
    "boot",
    IMAGE,
    "--name", name,
    "--mount-live", `${workspace}:${GUEST_WORKSPACE}`,
    "--cwd", GUEST_WORKSPACE,
    "-p", `${hostPort}:${GUEST_PORT}`,
    "--detach",
  ];
  console.error(
    `booting ${name} — host:${hostPort} → guest:${GUEST_PORT}, workspace=${workspace}`,
  );
  const r = spawnSync("machinen", args, { stdio: "inherit" });
  if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1);
}

function attach(name: string): never {
  const r = spawnSync("machinen", ["attach", name], { stdio: "inherit" });
  process.exit(r.status ?? 0);
}

const requested = process.env.MACHINEN_VM_NAME?.trim();
const vms = listVms();
const takenNames = new Set(vms.map((v) => v.name));
const takenPorts = new Set(vms.flatMap((v) => v.ports.map((p) => p.hostPort)));
const name = requested || pickName(takenNames);

if (takenNames.has(name)) {
  console.error(`${name} is already running — attaching…`);
  attach(name);
} else {
  ensureImage();
  const workspace = ensureWorkspace(name);
  const hostPort = pickPort(takenPorts);
  boot(name, hostPort, workspace);
  attach(name);
}
