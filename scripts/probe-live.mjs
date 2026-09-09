import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://abyss-eater.hikvision.workers.dev';
const BRANDED = 'https://abyss-eater.qs3d.site';
const PROTOCOL_VERSION = 2;
const HTTP_TIMEOUT_MS = 8000;
const WS_TIMEOUT_MS = 10000;

export function classifyHttpResult({ status = 0, error = null } = {}) {
  if (error) return 'NO_RESULT';
  return status >= 200 && status < 300 ? 'PASS' : 'FAIL';
}

export function redactUrl(value) {
  const url = new URL(String(value));
  for (const key of ['session', 'resume', 'token', 'authorization']) {
    if (url.searchParams.has(key)) url.searchParams.set(key, 'REDACTED');
  }
  return url.toString();
}

function markerPass(path, body) {
  if (path === '/') return body.includes('id="quick-dive-button"') && body.includes('id="chat-panel"');
  if (path === '/sw.js') return body.includes('abyss-eater-shell-v10') && body.includes('/client-social.mjs');
  if (path === '/health') {
    try { const value = JSON.parse(body); return value?.protocolVersion === PROTOCOL_VERSION; } catch { return false; }
  }
  return true;
}

async function probeHttpPath(base, path) {
  const url = new URL(path, base).toString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS), redirect: 'follow' });
    const body = await response.text();
    const status = classifyHttpResult({ status: response.status });
    return {
      path, url: redactUrl(url), httpStatus: response.status,
      result: status === 'PASS' && markerPass(path, body) ? 'PASS' : 'FAIL',
      bytes: Buffer.byteLength(body, 'utf8'),
    };
  } catch (error) {
    return { path, url: redactUrl(url), httpStatus: 0, result: 'NO_RESULT', error: String(error?.name || 'network_error') };
  }
}

async function probeHttpBase(base) {
  const checks = [];
  for (const path of ['/health', '/', '/sw.js']) checks.push(await probeHttpPath(base, path));
  return checks;
}

function websocketUrl(base) {
  const url = new URL('/ws', base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('name', 'Release Probe');
  url.searchParams.set('room', 'ocean-1');
  return url;
}

async function probeWebSocket(base) {
  const url = websocketUrl(base);
  return await new Promise((resolve) => {
    let settled = false;
    let socket;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket?.close(1000, 'release-probe'); } catch {}
      resolve(value);
    };
    const timer = setTimeout(() => finish({ url: redactUrl(url), result: 'NO_RESULT', stage: 'timeout' }), WS_TIMEOUT_MS);
    try { socket = new WebSocket(url); }
    catch { finish({ url: redactUrl(url), result: 'NO_RESULT', stage: 'construct' }); return; }
    socket.addEventListener('message', (event) => {
      let message;
      try { message = JSON.parse(String(event.data)); } catch { return; }
      if (message?.type === 'error') { finish({ url: redactUrl(url), result: 'FAIL', stage: 'server_error', code: message.code || 'error' }); return; }
      if (message?.type === 'welcome' && message.v === PROTOCOL_VERSION) {
        const seq = Number.isSafeInteger(message.inputSeq) ? message.inputSeq + 1 : 1;
        socket.send(JSON.stringify({ type: 'ping', v: PROTOCOL_VERSION, t: Date.now() }));
        socket.send(JSON.stringify({ type: 'input', v: PROTOCOL_VERSION, seq, dir: { x: 0, y: 0, z: 0 } }));
        return;
      }
      if (message?.type === 'pong' && message.v === PROTOCOL_VERSION) finish({ url: redactUrl(url), result: 'PASS', stage: 'join-ping-input' });
    });
    socket.addEventListener('error', () => finish({ url: redactUrl(url), result: 'NO_RESULT', stage: 'network_error' }));
    socket.addEventListener('close', () => { if (!settled) finish({ url: redactUrl(url), result: 'FAIL', stage: 'closed_early' }); });
  });
}

function aggregate(checks) {
  const results = checks.map((check) => check.result);
  if (results.includes('FAIL')) return 'FAIL';
  if (results.includes('NO_RESULT')) return 'NO_RESULT';
  return 'PASS';
}

async function main() {
  const targets = {};
  for (const [name, base] of Object.entries({ origin: ORIGIN, branded: BRANDED })) {
    const http = await probeHttpBase(base);
    const websocket = await probeWebSocket(base);
    targets[name] = { base, http, websocket, result: aggregate([...http, websocket]) };
  }
  const report = { protocolVersion: PROTOCOL_VERSION, targets, result: aggregate(Object.values(targets)) };
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/live-probe.json', `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invoked) main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
