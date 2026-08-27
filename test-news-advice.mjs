import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./web/src/ui/app_mobile.js', import.meta.url), 'utf8');
const store = new Map();
const windowMock = { addEventListener: () => {}, dispatchEvent: () => {}, GSXNewsState: null };
const context = vm.createContext({
  console, Date, Math, Number, Array, Object, String, JSON, Promise,
  window: windowMock,
  document: { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, hidden: false },
  localStorage: {
    getItem: key => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key)
  },
  location: { href: '' },
  setInterval: () => 0,
  setTimeout: () => 0,
  fetch: async () => { throw new Error('fetch not expected'); }
});
vm.runInContext(source, context);

function makeTrend(direction, count = 120, stepMs = 60000) {
  const rows = [];
  const end = Math.floor((Date.now() - stepMs * 2) / stepMs) * stepMs;
  let price = direction === 'up' ? 2400 : 2600;
  for (let i = 0; i < count; i++) {
    const o = price;
    const c = direction === 'up' ? o + 0.8 : o - 0.8;
    rows.push({ t: end - (count - 1 - i) * stepMs, o, h: Math.max(o, c) + 0.1, l: Math.min(o, c) - 0.1, c, v: 10 });
    price = c + (direction === 'up' ? 0.12 : -0.12);
  }
  return rows;
}

function advice(bars, news = null) {
  context.input = {
    bars,
    context: {
      tf: '1m',
      mtf: [
        { tf: '5m', bars: makeTrend('up', 100, 300000), source: 'd1' },
        { tf: '15m', bars: makeTrend('up', 100, 900000), source: 'd1' }
      ],
      expectedMtf: 2,
      live: { price: bars.at(-1).c, ts: Date.now(), receivedAt: Date.now(), source: 'd1' },
      barsSource: 'd1',
      enforceMTF: true,
      enforceFresh: true,
      news
    }
  };
  return vm.runInContext('computeAdvice(input.bars,input.context)', context);
}

const up = makeTrend('up');
const technical = advice(up);
assert.equal(technical.side, 'buy');

const supportive = advice(up, {
  ok: true,
  stale: false,
  goldBias: { direction: 'bullish', confidence: 90 },
  safety: { blockTechnicalSignal: false }
});
assert.equal(supportive.side, 'buy');
assert.ok(supportive.bullScore > technical.bullScore);
assert.ok(supportive.bullScore - technical.bullScore <= 0.900001, 'news weight must stay bounded');
assert.ok(supportive.reasons.some(reason => reason.includes('الأخبار داعمة')));

const blocked = advice(up, {
  ok: true,
  stale: false,
  goldBias: { direction: 'bullish', confidence: 90 },
  safety: { blockTechnicalSignal: true, reason: 'خبر شديد التأثير؛ اختبار' }
});
assert.equal(blocked.side, 'none', 'fresh critical news must veto a trade');
assert.ok(blocked.reasons.some(reason => reason.includes('خبر شديد التأثير')));

const opposing = advice(up, {
  ok: true,
  stale: false,
  goldBias: { direction: 'bearish', confidence: 90 },
  safety: { blockTechnicalSignal: false }
});
assert.notEqual(opposing.side, 'sell', 'news alone must never reverse a strong technical setup into a trade');

console.log('news advice tests passed');
