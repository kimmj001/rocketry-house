import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const appOutput = join(root, ".next", "server", "app");
const distOutput = join(root, "dist");
const clientOutput = join(distOutput, "client");

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
  if (route === "index") return join(clientOutput, "index.html");
  if (route === "_not-found") return join(clientOutput, "404.html");
  return join(clientOutput, ...route.split("/"), "index.html");
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

  mkdirSync(clientOutput, { recursive: true });

  copyDirectory(join(root, ".next", "static"), join(clientOutput, "_next", "static"));
  if (existsSync(join(root, "public"))) {
    cpSync(join(root, "public"), clientOutput, { recursive: true });
  }
  copyDirectory(join(root, ".openai"), join(distOutput, ".openai"));

  for (const htmlFile of walkFiles(appOutput).filter((file) => file.endsWith(".html"))) {
    copyFile(htmlFile, routeOutputPath(htmlFile));
  }

  writeWorkerEntrypoint();
}

function writeWorkerEntrypoint() {
  const serverDirectory = join(distOutput, "server");
  mkdirSync(serverDirectory, { recursive: true });
  writeFileSync(
    join(serverDirectory, "index.js"),
    `async function fetchAsset(request, env, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  return env.ASSETS.fetch(new Request(url, request));
}

export default {
  async fetch(request, env) {
    if (!env.ASSETS) {
      return new Response("Static asset binding is unavailable.", { status: 500 });
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;

    const url = new URL(request.url);
    if (!url.pathname.includes(".")) {
      const pathname = url.pathname.endsWith("/") ? \`\${url.pathname}index.html\` : \`\${url.pathname}/index.html\`;
      const routeResponse = await fetchAsset(request, env, pathname);
      if (routeResponse.status !== 404) return routeResponse;
    }

    return fetchAsset(request, env, "/404.html");
  },
};
`,
  );
}

run("next", ["build"]);
prepareStaticDist();
