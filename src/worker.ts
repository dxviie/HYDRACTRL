// Cloudflare Worker script
export default {
  async fetch(request: Request, env: any, ctx: any) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      
      // Let Workers Sites handle everything
      return env.ASSETS.fetch(request);
      
    } catch (error) {
      return new Response(`Server Error: ${error.toString()}`, { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }
};