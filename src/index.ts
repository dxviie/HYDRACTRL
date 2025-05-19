import { Elysia } from "elysia";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

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
  .listen(3000);

console.log(`HYDRACTRL running at http://localhost:${app.server?.port}`);
