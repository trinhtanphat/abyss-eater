const ORIGIN = 'abyss-eater.hikvision.workers.dev';

export default {
  async fetch(request) {
    const upstream = new URL(request.url);
    upstream.protocol = 'https:';
    upstream.hostname = ORIGIN;
    upstream.port = '';

    const proxiedRequest = new Request(upstream, request);
    return fetch(proxiedRequest);
  },
};
