/**
 * Paths and commands that depend on where the app runs: a repository checkout
 * (dev) or a packaged bundle with the compiled server next to it.
 */
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const APP_NAME = "HYDRACTRL";
export const APP_ID = "dev.d17e.hydractrl";

const here = dirname(fileURLToPath(import.meta.url));
/** desktop/ */
export const DESKTOP_DIR = resolve(here, "..", "..");
/** The HYDRACTRL repository root (only meaningful in a checkout). */
export const REPO_ROOT = resolve(DESKTOP_DIR, "..");
export const RENDERER_DIR = join(DESKTOP_DIR, "src", "renderer");
export const PRELOAD_PATH = join(DESKTOP_DIR, "src", "preload", "desktop.cjs");
export const ICON_PATH = join(DESKTOP_DIR, "resources", "icon.png");

export function resolvePaths({ packaged, resourcesPath, userDataPath, platform }) {
  const serverDir = packaged ? join(resourcesPath, "server") : null;
  const serverBinary = serverDir
    ? join(serverDir, platform === "win32" ? "hydractrl.exe" : "hydractrl")
    : null;
  return {
    serverDir,
    serverBinary,
    logsDir: join(userDataPath, "logs"),
    logFile: join(userDataPath, "logs", "hydractrl-desktop.log"),
    settingsFile: join(userDataPath, "settings.json"),
    windowStateFile: join(userDataPath, "window-state.json"),
  };
}

/**
 * How to start the server. Packaged: the bundled binary, which serves the
 * bundled `hydractrl-public` folder next to it. Checkout: build the client
 * once, then run the server with Bun's watcher, like `bun dev`.
 */
export function serverCommand({ packaged, paths, bunExecutable = "bun" }) {
  if (packaged) {
    return { file: paths.serverBinary, args: [], cwd: paths.serverDir };
  }
  return {
    prepare: { file: bunExecutable, args: ["run", "build:client"], cwd: REPO_ROOT },
    file: bunExecutable,
    args: ["--watch", "src/index.ts"],
    cwd: REPO_ROOT,
  };
}
