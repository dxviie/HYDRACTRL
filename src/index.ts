import { readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Elysia } from "elysia";
import { VERSION } from "./project.js";
import { createOutputHub } from "./server/outputHub";

const __dirname = dirname(fileURLToPath(import.meta.url));

// When running as executable, public dir is relative to executable location
// When running in dev/build, public dir is relative to project root
const isExecutable =
  process.execPath.endsWith("hydractrl.exe") || process.execPath.endsWith("hydractrl");
const publicDir = isExecutable
  ? join(dirname(process.execPath), "hydractrl-public")
  : join(__dirname, "..", "public");

// Load HTML and serve static assets. The interface is app.html; on the hosted
// site public/index.html is the landing page and the interface lives at /app,
// while this server (the executable, the desktop app, `bun dev`) opens
// straight into the interface at / and answers on /app too.
const appHtml = readFileSync(join(publicDir, "app.html"), "utf-8");
const outputHtml = readFileSync(join(publicDir, "output.html"), "utf-8");

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "video/ogg",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

function contentTypeFor(path: string) {
  return CONTENT_TYPES[extname(path).toLowerCase()] || "application/octet-stream";
}

const html = (content: string) =>
  new Response(content, { headers: { "Content-Type": "text/html; charset=utf-8" } });

// Fan-out between the UI and external render heads (see src/server/outputHub.ts)
const outputHub = createOutputHub({ log: (message) => console.log(message) });

// Port and bind address are overridable for hosts such as the desktop app:
// PORT picks the port (default 3000), HOST the interface (default: all).
const port = Number.parseInt(process.env.PORT || "", 10) || 3000;
const hostname = process.env.HOST?.trim() || undefined;
const listenOptions = hostname ? { port, hostname } : port;

// Create Elysia server
const app = new Elysia()
  .get("/", () => html(appHtml))
  .get("/app", () => html(appHtml))
  // Chrome-less render head that mirrors the UI over the output socket
  .get("/output", () => html(outputHtml))
  // Lets the client tell this server apart from a static host
  .get("/api/capabilities", () => ({ name: "hydractrl", outputSync: true, version: VERSION }))
  .ws("/ws/output", {
    open(ws) {
      outputHub.connect(ws.id, (text) => {
        ws.raw.send(text);
      });
    },
    message(ws, message) {
      outputHub.message(ws.id, message);
    },
    close(ws) {
      outputHub.disconnect(ws.id);
    },
  })
  .get("/assets/*", ({ path }) => {
    try {
      // Extract the part of the path after "/assets/"
      const assetPath = path.replace(/^\/assets\//, "");
      const filePath = join(publicDir, "assets", assetPath);

      // Read file as buffer to handle both text and binary files
      const content = readFileSync(filePath);
      return new Response(content, { headers: { "Content-Type": contentTypeFor(assetPath) } });
    } catch (err) {
      console.error(`Failed to serve asset: ${path}`);
      return new Response("Not found", { status: 404 });
    }
  })
  .get("/styles.css", () => {
    const css = readFileSync(join(publicDir, "styles.css"), "utf-8");
    return new Response(css, { headers: { "Content-Type": "text/css" } });
  })
  .get("/*", ({ path }) => {
    // Skip if it's already handled by other routes
    if (
      path === "/" ||
      path === "/app" ||
      path === "/output" ||
      path.startsWith("/api/") ||
      path.startsWith("/assets/") ||
      path === "/styles.css"
    ) {
      return;
    }

    try {
      // Remove leading slash and serve from public directory root
      const filePath = join(publicDir, path.slice(1));
      const content = readFileSync(filePath);
      return new Response(content, { headers: { "Content-Type": contentTypeFor(path) } });
    } catch (err) {
      console.error(`Failed to serve file: ${path}`);
      return new Response("Not found", { status: 404 });
    }
  })
  .listen(listenOptions);

const versionLabel = `v${VERSION}`.padEnd(12);

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    HYDRACTRL ${versionLabel}                     ║
║                                                               ║
║  🎛️  Live visual performance tool powered by hydra-synth      ║
║  🌐  Server running at http://localhost:${app.server?.port}                  ║
║  🎥  Output page at http://localhost:${app.server?.port}/output              ║
║  💫  Ready for visual synthesis                               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);
