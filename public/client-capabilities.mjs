export function classifyCapabilities(input = {}) {
  const serviceWorker = input.serviceWorker === true;
  if (input.modules !== true) {
    return { playable: false, reason: 'modules_unavailable', serviceWorker };
  }
  if (input.webgl !== true) {
    return { playable: false, reason: 'webgl_unavailable', serviceWorker };
  }
  return { playable: true, reason: null, serviceWorker };
}
