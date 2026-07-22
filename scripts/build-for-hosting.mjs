import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const isWindows = process.platform === "win32";
const isVercel = Boolean(process.env.VERCEL);

function run(command, args) {
  const cliPath = {
    next: join(root, "node_modules", "next", "dist", "bin", "next"),
    "opennextjs-cloudflare": join(root, "node_modules", "@opennextjs", "cloudflare", "dist", "cli", "index.js"),
  }[command];
  const executable = cliPath ? process.execPath : command;
  const commandArgs = cliPath ? [cliPath, ...args] : args;
  const result = spawnSync(executable, commandArgs, {
    cwd: root,
    env: process.env,
    shell: false,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error.message);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function copyDirectory(source, destination) {
  if (existsSync(destination)) {
    rmSync(destination, { recursive: true, force: true });
  }
  cpSync(source, destination, { recursive: true });
}

if (isWindows || isVercel) {
  run("next", ["build"]);
} else {
  run("opennextjs-cloudflare", ["build", "--skipWranglerConfigCheck"]);
  copyDirectory(join(root, ".open-next"), join(root, "dist"));
  copyDirectory(join(root, ".openai"), join(root, "dist", ".openai"));
}
