// Basic static site handler for Cloudflare Workers
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    try {
      // Check if the request is for a static asset
      if (path.startsWith('/assets/') || path === '/styles.css') {
        // Serve from __STATIC_CONTENT
        return await env.__STATIC_CONTENT.fetch(request);
      }
      
      // For the home page, serve index.html
      if (path === '/' || path === '/index.html') {
        return await env.__STATIC_CONTENT.fetch(
          new Request(`${url.origin}/index.html`, request)
        );
      }
      
      // For anything else, try to serve it
      return await env.__STATIC_CONTENT.fetch(request);
    } catch (e) {
      // If there's an error, return a simple error page
      return new Response(`Error: ${e.message}`, { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }
};