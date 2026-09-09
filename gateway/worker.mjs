const ORIGIN = 'abyss-eater.hikvision.workers.dev';
const PROXIED_PATHS = new Set(['/ws', '/health']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!PROXIED_PATHS.has(url.pathname)) {
      return env.ASSETS.fetch(request);
    }

    const upstream = new URL(request.url);
    upstream.protocol = 'https:';
    upstream.hostname = ORIGIN;
    upstream.port = '';

    const proxiedRequest = new Request(upstream, request);
    return fetch(proxiedRequest);
  },
};
