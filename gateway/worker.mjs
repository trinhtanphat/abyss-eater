const ORIGIN = 'abyss-eater.hikvision.workers.dev';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const shouldProxy = url.pathname === '/ws' || url.pathname === '/health' || url.pathname.startsWith('/api/');
    if (!shouldProxy) {
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
