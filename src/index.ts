import { Elysia } from 'elysia';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// Load HTML and serve static assets
const indexHtml = readFileSync(join(publicDir, 'index.html'), 'utf-8');

// Create Elysia server
const app = new Elysia()
  .get('/', () => new Response(indexHtml, { headers: { 'Content-Type': 'text/html' } }))
  .get('/assets/:file', ({ params }) => {
    try {
      const filePath = join(publicDir, 'assets', params.file);
      const content = readFileSync(filePath, 'utf-8');
      const contentType = params.file.endsWith('.js') 
        ? 'text/javascript' 
        : params.file.endsWith('.css') 
          ? 'text/css' 
          : 'application/octet-stream';
      
      return new Response(content, { headers: { 'Content-Type': contentType } });
    } catch (err) {
      return new Response('Not found', { status: 404 });
    }
  })
  .get('/styles.css', () => {
    const css = readFileSync(join(publicDir, 'styles.css'), 'utf-8');
    return new Response(css, { headers: { 'Content-Type': 'text/css' } });
  })
  .listen(3000);

console.log(`HYDRACTRL running at http://localhost:${app.server?.port}`);
