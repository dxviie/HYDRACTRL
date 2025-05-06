// Basic static site handler for Cloudflare Workers
export default {
  async fetch(request, env) {
    // Return the static asset from the static site
    return env.ASSETS.fetch(request);
  }
};