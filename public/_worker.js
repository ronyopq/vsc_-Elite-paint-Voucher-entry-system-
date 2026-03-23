export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const apiOrigin = "https://elite-voucher-api.ronybd.workers.dev";

    // Proxy backend routes through the same site origin so cookies work correctly.
    if (path.startsWith('/auth/') || path.startsWith('/api/') || path.startsWith('/v/')) {
      const upstreamUrl = `${apiOrigin}${path}${url.search}`;
      const upstreamRequest = new Request(upstreamUrl, request);
      return fetch(upstreamRequest);
    }

    // Serve static assets and index page from Pages.
    return env.ASSETS.fetch(request);
  }
};
