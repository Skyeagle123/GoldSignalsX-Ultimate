/* GoldSignalsX Mobile glue (namespaced, safe to include twice)
   - Polls the unified Worker (/price) and updates UI
   - Falls back automatically if endpoint switches between /price and /api/price
   - No global `let l` or similar — everything inside GSX namespace/IIFE
*/

(function () {
  'use strict';

  // Avoid redefining if script is injected twice
  if (window.GSX && window.GSX.__mobileGlueReady) return;

  const GSX = (window.GSX = window.GSX || {});

  // ---- Config ----
  const DEFAULT_BASES = [
    'https://gold-ticks.samer-mourtada.workers.dev',
    'https://goldsignalsx-worker.samer-mourtada.workers.dev'
  ];
  const POLL_MS = 3000;

  // ---- DOM ----
  const elBase = document.getElementById('base');    // input text (Worker URL)
  const elPrice = document.getElementById('price');  // span badge
  const btnPrice = document.getElementById('btnPrice');

  // ---- State ----
  let timer = null;
  let lastOkBase = null;

  function setPrice(v) {
    if (!elPrice) return;
    elPrice.textContent = v != null ? Number(v).toFixed(3) : '—';
  }
  function setBase(v) {
    if (elBase) elBase.value = v || '';
    localStorage.setItem('GSX_BASE', v || '');
  }
  function getBase() {
    const t = (elBase && elBase.value || '').trim();
    return t || localStorage.getItem('GSX_BASE') || '';
  }

  // Try /price → /api/price → /
  async function tryPrice(base) {
    const candidates = [`${base}/price`, `${base}/api/price`, base];
    for (const u of candidates) {
      try {
        const r = await fetch(u, { headers: { accept: 'application/json' }, cache: 'no-store' });
        if (!r.ok) continue;
        const j = await r.json().catch(() => ({}));
        const price = Number(j.price ?? j.close ?? j.last);
        const ts = Number(j.ts) || Date.now();
        if (Number.isFinite(price)) return { ok: true, price, ts, url: u, source: j.source || (u.includes('gold-ticks') ? 'gold-ticks' : 'worker') };
      } catch {}
    }
    return { ok: false };
  }

  // Direct stooq fallback (CSV)
  async function stooqFallback() {
    try {
      const r = await fetch('https://stooq.com/q/l/?s=xauusd&f=sd2t2ohlcvn&h&e=csv', { cache: 'no-store' });
      if (!r.ok) return { ok: false };
      const csv = await r.text();
      const row = (csv.trim().split(/\r?\n/)[1] || '').split(',');
      const close = Number(row[6]);
      const date = (row[1] || '') + 'T' + (row[2] || '') + 'Z';
      const ts = new Date(date).getTime() || Date.now();
      if (Number.isFinite(close)) return { ok: true, price: close, ts, source: 'stooq' };
    } catch {}
    return { ok: false };
  }

  // Unified get price
  async function getUnifiedPrice() {
    const bases = [];
    const userBase = getBase();
    if (userBase) bases.push(userBase);
    if (lastOkBase && !bases.includes(lastOkBase)) bases.push(lastOkBase);
    for (const d of DEFAULT_BASES) if (!bases.includes(d)) bases.push(d);

    for (const b of bases) {
      const out = await tryPrice(b);
      if (out.ok) { lastOkBase = b; if (!getBase()) setBase(b); return out; }
    }
    return await stooqFallback();
  }

  async function tick() {
    const res = await getUnifiedPrice();
    if (res && res.ok) {
      setPrice(res.price);
      elPrice && elPrice.classList.remove('text-red-400');
      elPrice && elPrice.classList.add('text-white');
    } else {
      // show dash on failure
      setPrice(null);
      elPrice && elPrice.classList.remove('text-white');
      elPrice && elPrice.classList.add('text-red-400');
    }
  }

  function start() {
    if (timer) return;
    tick();
    timer = setInterval(tick, POLL_MS);
  }
  function stop() {
    if (timer) clearInterval(timer), timer = null;
  }

  btnPrice && btnPrice.addEventListener('click', tick);
  elBase && elBase.addEventListener('change', () => setBase(getBase()));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });

  // Auto-start after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  GSX.__mobileGlueReady = true;
  GSX.__stopPoll = stop;
  GSX.__startPoll = start;
})();