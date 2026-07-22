import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const appOutput = join(root, ".next", "server", "app");
const distOutput = join(root, "dist");

function run(command, args) {
  const cliPath = {
    next: join(root, "node_modules", "next", "dist", "bin", "next"),
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

function walkFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    return statSync(fullPath).isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

function routeOutputPath(htmlFile) {
  const route = relative(appOutput, htmlFile).replace(/\\/g, "/").replace(/\.html$/, "");
  if (route === "index") return join(distOutput, "index.html");
  if (route === "_not-found") return join(distOutput, "404.html");
  return join(distOutput, ...route.split("/"), "index.html");
}

function copyFile(source, destination) {
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}

function prepareStaticDist() {
  if (existsSync(distOutput)) {
    rmSync(distOutput, { recursive: true, force: true });
  }
  mkdirSync(distOutput, { recursive: true });

  copyDirectory(join(root, ".next", "static"), join(distOutput, "_next", "static"));
  if (existsSync(join(root, "public"))) {
    cpSync(join(root, "public"), distOutput, { recursive: true });
  }
  copyDirectory(join(root, ".openai"), join(distOutput, ".openai"));

  for (const htmlFile of walkFiles(appOutput).filter((file) => file.endsWith(".html"))) {
    copyFile(htmlFile, routeOutputPath(htmlFile));
  }
}

run("next", ["build"]);
prepareStaticDist();
