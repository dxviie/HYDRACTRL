#!/usr/bin/env node
/**
 * Compile the HYDRACTRL server into a single binary for a target platform and
 * stage it with the web assets, in the layout the binary expects at runtime:
 *
 *   <out>/hydractrl[.exe]
 *   <out>/hydractrl-public/     public/ plus local-assets/
 *   <out>/manifest.json
 *
 * Usage: bun scripts/build-server.mjs --platform darwin --arch arm64 --out .server-staging/current
 * Defaults to the current platform and architecture. Needs Bun on the PATH.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const DESKTOP_DIR = resolve(here, "..");
export const REPO_ROOT = resolve(DESKTOP_DIR, "..");

export const BUN_TARGETS = Object.freeze({
  "darwin-arm64": "bun-darwin-arm64",
  "darwin-x64": "bun-darwin-x64",
  "win32-x64": "bun-windows-x64",
  "linux-x64": "bun-linux-x64",
  "linux-arm64": "bun-linux-arm64",
});

export function parseArgs(argv) {
  const options = {
    platform: process.platform,
    arch: process.arch,
    out: join(DESKTOP_DIR, ".server-staging", "current"),
    skipClient: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--platform") options.platform = argv[++i];
    else if (arg === "--arch") options.arch = argv[++i];
    else if (arg === "--out") options.out = resolve(argv[++i]);
    else if (arg === "--skip-client") options.skipClient = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

export function bunTargetFor(platform, arch) {
  const target = BUN_TARGETS[`${platform}-${arch}`];
  if (!target) {
    throw new Error(
      `no Bun compile target for ${platform}-${arch} (known: ${Object.keys(BUN_TARGETS).join(", ")})`,
    );
  }
  return target;
}

export function buildServer({
  platform,
  arch,
  out,
  skipClient = false,
  exec = execFileSync,
  fs = { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync },
  log = (message) => console.log(`[build-server] ${message}`),
}) {
  const target = bunTargetFor(platform, arch);
  const binaryName = platform === "win32" ? "hydractrl.exe" : "hydractrl";
  const binaryPath = join(out, binaryName);
  const shell = process.platform === "win32";

  if (!skipClient) {
    log("building the client bundles");
    exec("bun", ["run", "build:client"], { cwd: REPO_ROOT, stdio: "inherit", shell });
  }

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  log(`compiling the server for ${target}`);
  exec(
    "bun",
    ["build", "src/index.ts", "--compile", `--target=${target}`, "--outfile", binaryPath],
    { cwd: REPO_ROOT, stdio: "inherit", shell },
  );

  const publicDir = join(out, "hydractrl-public");
  fs.cpSync(join(REPO_ROOT, "public"), publicDir, { recursive: true });
  const localAssets = join(REPO_ROOT, "local-assets");
  if (fs.existsSync(localAssets)) fs.cpSync(localAssets, publicDir, { recursive: true });

  const rootPackage = JSON.parse(fs.readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
  fs.writeFileSync(
    join(out, "manifest.json"),
    `${JSON.stringify({ name: "hydractrl-server", version: rootPackage.version, target, builtAt: new Date().toISOString() }, null, 2)}\n`,
  );
  log(`staged ${binaryName} and hydractrl-public in ${out}`);
  return { binaryPath, publicDir, target };
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    buildServer(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(`[build-server] ${error.message}`);
    process.exit(1);
  }
}
