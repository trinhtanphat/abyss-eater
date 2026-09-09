export function createNetworkClient({
  onStatus = () => {},
  onWelcome = () => {},
  onSnapshot = () => {},
  onPong = () => {},
  onEaten = () => {},
  onError = () => {},
} = {}) {
  let socket = null;
  let reconnectTimer = null;
  let shouldReconnect = false;
  let credentials = null;
  let inputSeq = 0;
  let pingSentAt = 0;

  function sanitized(value, fallback, max) {
    return (String(value || '').replace(/[^\p{L}\p{N} _.-]/gu, '').replace(/\s+/g, ' ').trim() || fallback).slice(0, max);
  }

  function connect({ name, room }) {
    disconnect(false);
    credentials = {
      name: sanitized(name, 'Little Fish', 20),
      room: sanitized(room, 'ocean-1', 24).toLowerCase(),
    };
    shouldReconnect = true;
    onStatus('Connecting…', false);

    const wsUrl = new URL('/ws', location.href);
    wsUrl.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl.searchParams.set('name', credentials.name);
    wsUrl.searchParams.set('room', credentials.room);
    socket = new WebSocket(wsUrl);

    socket.addEventListener('open', () => onStatus('Online', true));
    socket.addEventListener('message', (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === 'welcome') {
        onWelcome(message);
        return;
      }
      if (message.type === 'snapshot') {
        onSnapshot(message);
        return;
      }
      if (message.type === 'pong') {
        const ping = Math.max(0, Date.now() - Number(message.t || pingSentAt));
        onPong(ping, message);
        return;
      }
      if (message.type === 'eaten') {
        onEaten(message);
        return;
      }
      if (message.type === 'error') onError(message);
    });
    socket.addEventListener('close', () => {
      onStatus(shouldReconnect ? 'Reconnecting…' : 'Offline', false);
      if (shouldReconnect && credentials) {
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => connect(credentials), 1600);
      }
    });
    socket.addEventListener('error', () => onStatus('Connection issue', false));
  }

  function disconnect(reconnect = false) {
    shouldReconnect = Boolean(reconnect);
    clearTimeout(reconnectTimer);
    if (socket) {
      try { socket.close(1000, 'client disconnect'); } catch {}
    }
    socket = null;
  }

  function sendInput(dir) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ type: 'input', seq: ++inputSeq, dir }));
    return true;
  }

  function ping() {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    pingSentAt = Date.now();
    socket.send(JSON.stringify({ type: 'ping', t: pingSentAt }));
    return true;
  }

  return {
    connect,
    disconnect,
    sendInput,
    ping,
    get connected() { return socket?.readyState === WebSocket.OPEN; },
    get credentials() { return credentials ? { ...credentials } : null; },
  };
}
