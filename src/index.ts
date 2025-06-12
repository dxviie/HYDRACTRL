import { Elysia } from "elysia";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// When running as executable, public dir is relative to executable location
// When running in dev/build, public dir is relative to project root
const isExecutable = process.execPath.endsWith("hydractrl.exe") || process.execPath.endsWith("hydractrl");
const publicDir = isExecutable 
  ? join(dirname(process.execPath), "hydractrl-public")
  : join(__dirname, "..", "public");

// Load HTML and serve static assets
const indexHtml = readFileSync(join(publicDir, "index.html"), "utf-8");

// Create Elysia server
const app = new Elysia()
  .get("/", () => new Response(indexHtml, { headers: { "Content-Type": "text/html" } }))
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
      else if (assetPath.endsWith(".jpg") || assetPath.endsWith(".jpeg")) contentType = "image/jpeg";
      else if (assetPath.endsWith(".svg")) contentType = "image/svg+xml";
      else if (assetPath.endsWith(".ico")) contentType = "image/x-icon";
      else if (assetPath.endsWith(".mp4")) contentType = "video/mp4";
      else if (assetPath.endsWith(".webm")) contentType = "video/webm";
      else if (assetPath.endsWith(".ogg")) contentType = "video/ogg";
      else if (assetPath.endsWith(".avi")) contentType = "video/x-msvideo";
      else if (assetPath.endsWith(".mov")) contentType = "video/quicktime";
      
      return new Response(content, { headers: { "Content-Type": contentType } });
    } catch (err) {
      console.error(`Failed to serve asset: ${path}`, err);
      return new Response("Not found", { status: 404 });
    }
  })
  .get("/styles.css", () => {
    const css = readFileSync(join(publicDir, "styles.css"), "utf-8");
    return new Response(css, { headers: { "Content-Type": "text/css" } });
  })
  .get("/*", ({ path }) => {
    // Skip if it's already handled by other routes
    if (path === "/" || path.startsWith("/assets/") || path === "/styles.css") {
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
      console.error(`Failed to serve file: ${path}`, err);
      return new Response("Not found", { status: 404 });
    }
  })
  .listen(3000);

console.log(`HYDRACTRL running at http://localhost:${app.server?.port}`);
