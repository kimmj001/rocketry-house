import fs from "node:fs/promises";
import path from "node:path";

const owner = "kimmj001";
const repo = "rocketry-house";
const branch = "main";
const root = process.cwd();
const token = process.env.GITHUB_TOKEN;

if (!token) {
  throw new Error("Set GITHUB_TOKEN before running this script.");
}

const ignored = new Set([".git", ".next", "node_modules"]);
const ignoredFiles = new Set([
  ".env.local",
  "rocket-dev-3000.err.log",
  "rocket-dev-3000.out.log",
  "rocket-dev-3005.err.log",
  "rocket-dev-3005.out.log",
  "server.err.log",
  "server.out.log",
  "tsconfig.tsbuildinfo",
  "vercel-failure.html"
]);

async function github(endpoint, options = {}) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers ?? {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${body}`);
  }

  return response.status === 204 ? null : response.json();
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    const relative = path.relative(root, absolute).replaceAll(path.sep, "/");
    if (entry.isDirectory()) {
      files.push(...await walk(absolute));
    } else if (!ignoredFiles.has(entry.name)) {
      files.push(relative);
    }
  }
  return files;
}

async function currentHead() {
  try {
    const ref = await github(`/repos/${owner}/${repo}/git/ref/heads/${branch}`);
    return ref.object.sha;
  } catch {
    return null;
  }
}

async function main() {
  const files = await walk(root);
  const blobs = [];

  for (const file of files) {
    const bytes = await fs.readFile(path.join(root, file));
    const blob = await github(`/repos/${owner}/${repo}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({
        content: bytes.toString("base64"),
        encoding: "base64"
      })
    });
    blobs.push({ path: file, mode: "100644", type: "blob", sha: blob.sha });
  }

  const parentSha = await currentHead();
  const baseTree = parentSha ? (await github(`/repos/${owner}/${repo}/git/commits/${parentSha}`)).tree.sha : undefined;
  const tree = await github(`/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      ...(baseTree ? { base_tree: baseTree } : {}),
      tree: blobs
    })
  });

  const commit = await github(`/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: "Deploy Rocketry House MVP",
      tree: tree.sha,
      parents: parentSha ? [parentSha] : []
    })
  });

  if (parentSha) {
    await github(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: false })
    });
  } else {
    await github(`/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha })
    });
  }

  console.log(`Published ${files.length} files to ${owner}/${repo}@${branch}`);
  console.log(`Commit: ${commit.sha}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
