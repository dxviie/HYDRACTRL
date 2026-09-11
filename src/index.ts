import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Elysia } from "elysia";
import { createOutputHub } from "./server/outputHub";

const __dirname = dirname(fileURLToPath(import.meta.url));

// When running as executable, public dir is relative to executable location
// When running in dev/build, public dir is relative to project root
const isExecutable =
  process.execPath.endsWith("hydractrl.exe") || process.execPath.endsWith("hydractrl");
const publicDir = isExecutable
  ? join(dirname(process.execPath), "hydractrl-public")
  : join(__dirname, "..", "public");

// Load HTML and serve static assets
const indexHtml = readFileSync(join(publicDir, "index.html"), "utf-8");
const outputHtml = readFileSync(join(publicDir, "output.html"), "utf-8");

// Fan-out between the UI and external render heads (see src/server/outputHub.ts)
const outputHub = createOutputHub({ log: (message) => console.log(message) });

// Create Elysia server
const app = new Elysia()
  .get("/", () => new Response(indexHtml, { headers: { "Content-Type": "text/html" } }))
  // Chrome-less render head that mirrors the UI over the output socket
  .get("/output", () => new Response(outputHtml, { headers: { "Content-Type": "text/html" } }))
  // Lets the client tell this server apart from a static host
  .get("/api/capabilities", () => ({ name: "hydractrl", outputSync: true }))
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

      // Determine content type based on file extension
      let contentType = "application/octet-stream";
      if (assetPath.endsWith(".js")) contentType = "application/javascript";
      else if (assetPath.endsWith(".css")) contentType = "text/css";
      else if (assetPath.endsWith(".json")) contentType = "application/json";
      else if (assetPath.endsWith(".png")) contentType = "image/png";
      else if (assetPath.endsWith(".jpg") || assetPath.endsWith(".jpeg"))
        contentType = "image/jpeg";
      else if (assetPath.endsWith(".svg")) contentType = "image/svg+xml";
      else if (assetPath.endsWith(".ico")) contentType = "image/x-icon";
      else if (assetPath.endsWith(".mp4")) contentType = "video/mp4";
      else if (assetPath.endsWith(".webm")) contentType = "video/webm";
      else if (assetPath.endsWith(".ogg")) contentType = "video/ogg";
      else if (assetPath.endsWith(".avi")) contentType = "video/x-msvideo";
      else if (assetPath.endsWith(".mov")) contentType = "video/quicktime";

      return new Response(content, { headers: { "Content-Type": contentType } });
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

      // Determine content type based on file extension
      let contentType = "application/octet-stream";
      if (path.endsWith(".js")) contentType = "application/javascript";
      else if (path.endsWith(".css")) contentType = "text/css";
      else if (path.endsWith(".json")) contentType = "application/json";
      else if (path.endsWith(".png")) contentType = "image/png";
      else if (path.endsWith(".jpg") || path.endsWith(".jpeg")) contentType = "image/jpeg";
      else if (path.endsWith(".svg")) contentType = "image/svg+xml";
      else if (path.endsWith(".ico")) contentType = "image/x-icon";
      else if (path.endsWith(".mp4")) contentType = "video/mp4";
      else if (path.endsWith(".webm")) contentType = "video/webm";
      else if (path.endsWith(".ogg")) contentType = "video/ogg";
      else if (path.endsWith(".avi")) contentType = "video/x-msvideo";
      else if (path.endsWith(".mov")) contentType = "video/quicktime";

      return new Response(content, { headers: { "Content-Type": contentType } });
    } catch (err) {
      console.error(`Failed to serve file: ${path}`);
      return new Response("Not found", { status: 404 });
    }
  })
  .listen(3000);

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                         HYDRACTRL                             ║
║                                                               ║
║  🎛️  Live visual performance tool powered by hydra-synth      ║
║  🌐  Server running at http://localhost:${app.server?.port}                  ║
║  🎥  Output page at http://localhost:${app.server?.port}/output              ║
║  💫  Ready for visual synthesis                               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);
