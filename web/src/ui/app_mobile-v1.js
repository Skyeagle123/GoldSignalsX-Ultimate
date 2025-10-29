
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
  const DEFAULT_BASE = 'https://goldsignalsx-worker.samer-mourtada.workers.dev';
  const LS_KEY = 'GSX_BASE_URL';
  const POLL_MS = 1000;

  // ---- Base URL getters/setters ----
  GSX.getBase = function () {
    try { return localStorage.getItem(LS_KEY) || DEFAULT_BASE; } catch { return DEFAULT_BASE; }
  };
  GSX.setBase = function (url) {
    if (typeof url === 'string' && url.trim()) {
      try { localStorage.setItem(LS_KEY, url.trim().replace(/\/+$/, '')); } catch {}
    }
  };

  // ---- Price fetcher (gold-ticks format) ----
  GSX.fetchPrice = async function () {
    const base = (GSX.getBase() || '').replace(/\/+$/, '');
    const candidates = [`${base}/price`, `${base}/api/price`, base];
    const tried = [];

    for (const u of candidates) {
      try {
        const r = await fetch(u, { headers: { accept: 'application/json' }, cache: 'no-store' });
        tried.push({ url: u, status: r.status });
        if (!r.ok) continue;
        const j = await r.json();
        // Normalize to gold-ticks-like shape
        const price = Number(j.price ?? j.close ?? j.last);
        const symbol = j.symbol || 'XAUUSD';
        const src = j.source || 'gold-ticks';
        const date = j.date || (j.isoTime ? j.isoTime.slice(0, 10) : '');
        const time = j.time || (j.isoTime ? j.isoTime.slice(11, 19) : '');
        const isoTime = j.isoTime || (typeof j.ts === 'number' ? new Date(j.ts).toISOString() : null);
        const ts = typeof j.ts === 'number' ? j.ts : (isoTime ? Date.parse(isoTime) : Date.now());
        if (Number.isFinite(price)) {
          return { ok: true, tried, data: { source: src, symbol, price, close: price, date, time, isoTime, ts } };
        }
      } catch (err) {
        tried.push({ url: u, error: String(err) });
      }
    }
    return { ok: false, tried };
  };

  // ---- UI updater ----
  function updateUI(meta) {
    try {
      // If the app defines a global hook, prefer it.
      if (typeof window.setLivePrice === 'function') {
        window.setLivePrice(meta.price, meta);
        return;
      }
      // Otherwise look for default elements
      const elPrice = document.getElementById('livePrice');
      const elSrc = document.getElementById('liveSource');
      const elTime = document.getElementById('liveTime');
      if (elPrice) elPrice.textContent = (Math.round(meta.price * 1000) / 1000).toString();
      if (elSrc) elSrc.textContent = meta.source;
      if (elTime) elTime.textContent = meta.isoTime ? new Date(meta.isoTime).toLocaleTimeString() : '';
    } catch {}
  }

  // ---- Poller ----
  let _timer = null;
  async function tick() {
    const out = await GSX.fetchPrice();
    if (out && out.ok && out.data) updateUI(out.data);
  }
  function start() {
    if (_timer) return;
    tick();
    _timer = setInterval(tick, POLL_MS);
  }
  function stop() {
    if (_timer) { clearInterval(_timer); _timer = null; }
  }

  // Pause when tab hidden to save battery
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

/* === GSX Mobile Glue (namespaced; no globals) ===
   - Polls unified worker for /price (or /api/price) every 1s
   - Normalizes response to gold-ticks shape
   - Calls window.setLivePrice(price, meta) if available, else updates #livePrice/#liveSource/#liveTime
*/
(function () {
  'use strict';
  if (window.GSX && window.GSX.__mobileGlueReady) return;

  const GSX = (window.GSX = window.GSX || {});
  const DEFAULT_BASE = 'https://goldsignalsx-worker.samer-mourtada.workers.dev';
  const LS_KEY = 'GSX_BASE_URL';
  const POLL_MS = 1000;

  GSX.getBase = function () {
    try { return localStorage.getItem(LS_KEY) || DEFAULT_BASE; } catch { return DEFAULT_BASE; }
  };
  GSX.setBase = function (url) {
    if (typeof url === 'string' && url.trim()) {
      try { localStorage.setItem(LS_KEY, url.trim().replace(/\/+$/, '')); } catch {}
    }
  };

  GSX.fetchPrice = async function () {
    const base = (GSX.getBase() || '').replace(/\/+$/, '');
    const candidates = [`${base}/price`, `${base}/api/price`, base];
    const tried = [];
    for (const u of candidates) {
      try {
        const r = await fetch(u, { headers: { accept: 'application/json' }, cache: 'no-store' });
        tried.push({ url: u, status: r.status });
        if (!r.ok) continue;
        const j = await r.json();
        const price = Number(j.price ?? j.close ?? j.last);
        const symbol = j.symbol || 'XAUUSD';
        const src = j.source || 'gold-ticks';
        const date = j.date || (j.isoTime ? j.isoTime.slice(0, 10) : '');
        const time = j.time || (j.isoTime ? j.isoTime.slice(11, 19) : '');
        const isoTime = j.isoTime || (typeof j.ts === 'number' ? new Date(j.ts).toISOString() : null);
        const ts = typeof j.ts === 'number' ? j.ts : (isoTime ? Date.parse(isoTime) : Date.now());
        if (Number.isFinite(price)) {
          return { ok: true, tried, data: { source: src, symbol, price, close: price, date, time, isoTime, ts } };
        }
      } catch (err) {
        tried.push({ url: u, error: String(err) });
      }
    }
    return { ok: false, tried };
  };

  function updateUI(meta) {
    try {
      if (typeof window.setLivePrice === 'function') {
        window.setLivePrice(meta.price, meta);
        return;
      }
      const elPrice = document.getElementById('livePrice');
      const elSrc = document.getElementById('liveSource');
      const elTime = document.getElementById('liveTime');
      if (elPrice) elPrice.textContent = (Math.round(meta.price * 1000) / 1000).toString();
      if (elSrc) elSrc.textContent = meta.source;
      if (elTime) elTime.textContent = meta.isoTime ? new Date(meta.isoTime).toLocaleTimeString() : '';
    } catch {}
  }

  let _timer = null;
  async function tick() {
    const out = await GSX.fetchPrice();
    if (out && out.ok && out.data) updateUI(out.data);
  }
  function start() {
    if (_timer) return;
    tick();
    _timer = setInterval(tick, POLL_MS);
  }
  function stop() {
    if (_timer) { clearInterval(_timer); _timer = null; }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  GSX.__mobileGlueReady = true;
  GSX.__stopPoll = stop;
  GSX.__startPoll = start;
})();
