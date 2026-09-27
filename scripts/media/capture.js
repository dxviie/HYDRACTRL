/**
 * Re-shoot the landing page's screenshots and videos from the real interface,
 * or rebuild the starter bank. Starts its own server on a free port. See
 * scripts/media/README.md.
 *
 *   bun run media                        every screenshot and video
 *   bun run media code-editor setup-code just these
 *   bun run media starter-bank           the starter bank, from src/sketches.js
 *   bun run media --out /tmp/media       write somewhere other than public/site
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { FFMPEG } from "./rig.js";
import { STARTER_BANK } from "./scenes.js";
import { MEDIA, SHOTS } from "./shots.js";

const ROOT = join(import.meta.dir, "..", "..");

const USAGE = `Usage: bun run media [shot…] [--out <dir>]

Shots (all but starter-bank by default):
${Object.entries(SHOTS)
  .map(([name, shot]) => `  ${name.padEnd(20)} ${shot.kind}`)
  .join("\n")}

Needs ffmpeg (or FFMPEG=/path/to/ffmpeg) and Playwright's Chromium
(bunx playwright-core install chromium, or CHROMIUM=/path/to/chrome).`;

function parseArgs(argv) {
  const args = { names: [], out: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") args.out = argv[++i];
    else if (argv[i] === "--help" || argv[i] === "-h") args.help = true;
    else args.names.push(argv[i]);
  }
  return args;
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

async function startServer() {
  const port = await freePort();
  const server = Bun.spawn([process.execPath, "src/index.ts"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1" },
    stdout: "ignore",
    stderr: "inherit",
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(`${base}/api/capabilities`);
      if (response.ok) return { server, base };
    } catch {
      // Not listening yet
    }
    await Bun.sleep(100);
  }
  server.kill();
  throw new Error("the HYDRACTRL server did not start");
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(USAGE);
  process.exit(0);
}
const names = args.names.length > 0 ? args.names : MEDIA;
const unknown = names.filter((name) => !SHOTS[name]);
if (unknown.length > 0) {
  console.error(`Unknown shot: ${unknown.join(", ")}\n\n${USAGE}`);
  process.exit(1);
}
try {
  execFileSync(FFMPEG, ["-version"], { stdio: "ignore" });
} catch {
  console.error(`ffmpeg not found (tried "${FFMPEG}"); install it or set FFMPEG.`);
  process.exit(1);
}

const out = args.out ? resolve(args.out) : join(ROOT, "public", "site");
mkdirSync(out, { recursive: true });
const bankFile = args.out ? join(out, "hydractrl-init-basic.json") : STARTER_BANK;
const { server, base } = await startServer();
try {
  for (const name of names) {
    const started = performance.now();
    process.stdout.write(`${name}… `);
    await SHOTS[name].run({ base, out, bankFile });
    console.log(`done (${Math.round((performance.now() - started) / 1000)} s)`);
  }
} finally {
  server.kill();
}
