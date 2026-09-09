const PROTOCOL_VERSION = 2;
const VERSIONED_MESSAGE_TYPES = new Set(['welcome', 'snapshot', 'pong', 'eaten', 'chat', 'error']);

export function createNetworkClient({
  onStatus = () => {},
  onWelcome = () => {},
  onSnapshot = () => {},
  onPong = () => {},
  onEaten = () => {},
  onChat = () => {},
  onError = () => {},
  onProtocolMismatch = () => {},
} = {}) {
  let socket = null;
  let reconnectTimer = null;
  let shouldReconnect = false;
  let credentials = null;
  let inputSeq = 0;
  let pingSentAt = 0;
  let protocolBlocked = false;

  function sanitized(value, fallback, max) {
    return (String(value || '').replace(/[^\p{L}\p{N} _.-]/gu, '').replace(/\s+/g, ' ').trim() || fallback).slice(0, max);
  }

  function sanitizedSession(value) {
    const token = typeof value === 'string' ? value.trim() : '';
    if (token.length < 3 || token.length > 4096) return '';
    return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) ? token : '';
  }

  function resumeStorageKey(room) {
    return `abyss-eater-resume:${room}`;
  }

  function readResumeKey(room) {
    try { return sessionStorage.getItem(resumeStorageKey(room)) || ''; } catch { return ''; }
  }

  function writeResumeKey(room, resumeKey) {
    try {
      if (resumeKey) sessionStorage.setItem(resumeStorageKey(room), resumeKey);
      else sessionStorage.removeItem(resumeStorageKey(room));
    } catch {}
  }

  function blockForProtocolMismatch() {
    protocolBlocked = true;
    shouldReconnect = false;
    clearTimeout(reconnectTimer);
    onStatus('Upgrade required', false);
    onProtocolMismatch();
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1002, 'protocol-version');
  }

  function connect({ name, room, session = '' }) {
    clearTimeout(reconnectTimer);
    if (protocolBlocked) {
      onStatus('Upgrade required', false);
      return;
    }

    disconnect(false);
    credentials = {
      name: sanitized(name, 'Little Fish', 20),
      room: sanitized(room, 'ocean-1', 24).toLowerCase(),
      session: sanitizedSession(session),
    };
    const resumeKey = readResumeKey(credentials.room);
    shouldReconnect = true;
    onStatus('Connecting…', false);

    const wsUrl = new URL('/ws', location.href);
    wsUrl.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl.searchParams.set('name', credentials.name);
    wsUrl.searchParams.set('room', credentials.room);
    if (credentials.session) wsUrl.searchParams.set('session', credentials.session);
    if (resumeKey) wsUrl.searchParams.set('resume', resumeKey);
    socket = new WebSocket(wsUrl);

    socket.addEventListener('open', () => onStatus('Online', true));
    socket.addEventListener('message', (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (VERSIONED_MESSAGE_TYPES.has(message?.type) && message.v !== PROTOCOL_VERSION) {
        blockForProtocolMismatch();
        return;
      }
      if (message.type === 'welcome') {
        if (Number.isSafeInteger(message.inputSeq) && message.inputSeq >= 0) inputSeq = message.inputSeq;
        if (typeof message.resumeKey === 'string' && message.resumeKey) writeResumeKey(credentials.room, message.resumeKey);
        onWelcome(message);
        return;
      }
      if (message.type === 'snapshot') { onSnapshot(message); return; }
      if (message.type === 'pong') {
        const ping = Math.max(0, Date.now() - Number(message.t || pingSentAt));
        onPong(ping, message);
        return;
      }
      if (message.type === 'eaten') { onEaten(message); return; }
      if (message.type === 'chat') { onChat(message); return; }
      if (message.type === 'error') onError(message);
    });
    socket.addEventListener('close', () => {
      if (protocolBlocked) {
        onStatus('Upgrade required', false);
        return;
      }
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

  function sendInput(dir, boost = false) {
    if (!socket || socket.readyState !== WebSocket.OPEN || protocolBlocked) return false;
    socket.send(JSON.stringify({ type: 'input', v: PROTOCOL_VERSION, seq: ++inputSeq, dir, boost: Boolean(boost) }));
    return true;
  }

  function sendChat(text) {
    if (!socket || socket.readyState !== WebSocket.OPEN || protocolBlocked) return false;
    const value = String(text ?? '').trim().slice(0, 160);
    if (!value) return false;
    socket.send(JSON.stringify({ type: 'chat', v: PROTOCOL_VERSION, text: value }));
    return true;
  }

  function ping() {
    if (!socket || socket.readyState !== WebSocket.OPEN || protocolBlocked) return false;
    pingSentAt = Date.now();
    socket.send(JSON.stringify({ type: 'ping', v: PROTOCOL_VERSION, t: pingSentAt }));
    return true;
  }

  return {
    connect,
    disconnect,
    sendInput,
    sendChat,
    ping,
    get connected() { return socket?.readyState === WebSocket.OPEN; },
    get credentials() { return credentials ? { ...credentials } : null; },
    get protocolBlocked() { return protocolBlocked; },
  };
}

export { PROTOCOL_VERSION, VERSIONED_MESSAGE_TYPES };
