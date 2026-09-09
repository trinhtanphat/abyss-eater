export const MAX_CHAT_LENGTH = 160;
export const CHAT_RATE_LIMIT = 3;
export const CHAT_RATE_WINDOW_MS = 5_000;
export const CHAT_DUPLICATE_WINDOW_MS = 8_000;

const PROHIBITED_TERMS = Object.freeze(['fuck', 'shit', 'bitch']);

export function normalizeChatText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CHAT_LENGTH);
}

export function containsProhibitedTerm(value) {
  const text = normalizeChatText(value).toLowerCase();
  return PROHIBITED_TERMS.some((term) => new RegExp(`(^|\\W)${term}(?=\\W|$)`, 'u').test(text));
}

function initialState(now) {
  return { windowStartedAt: now, count: 0, lastText: '', lastTextAt: -1 };
}
export function acceptChatMessage(value, state, now = Date.now()) {
  const text = normalizeChatText(value);
  if (!text) return { ok: false, code: 'chat_empty', state: state ?? initialState(0) };
  if (containsProhibitedTerm(text)) return { ok: false, code: 'chat_prohibited', state: state ?? initialState(0) };

  const timestamp = Number.isFinite(now) ? now : 0;
  const current = state && typeof state === 'object' ? state : initialState(timestamp);
  const reset = !Number.isFinite(current.windowStartedAt)
    || timestamp < current.windowStartedAt
    || timestamp - current.windowStartedAt >= CHAT_RATE_WINDOW_MS;
  const windowStartedAt = reset ? timestamp : current.windowStartedAt;
  const count = reset ? 0 : Math.max(0, Math.floor(Number(current.count) || 0));
  const lastText = normalizeChatText(current.lastText || '');
  const lastTextAt = Number.isFinite(current.lastTextAt) ? current.lastTextAt : -1;

  if (lastText && lastText === text && timestamp >= lastTextAt
    && timestamp - lastTextAt < CHAT_DUPLICATE_WINDOW_MS) {
    return { ok: false, code: 'chat_duplicate', state: { ...current } };
  }
  if (count >= CHAT_RATE_LIMIT) {
    return { ok: false, code: 'chat_rate_limited', state: { ...current } };
  }

  return {
    ok: true,
    text,
    state: { windowStartedAt, count: count + 1, lastText: text, lastTextAt: timestamp },
  };
}
