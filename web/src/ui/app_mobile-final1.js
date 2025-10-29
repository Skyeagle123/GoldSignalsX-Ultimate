
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



/* === GSX Mobile Glue (non-invasive) =========================================
   - Appends to existing code without modifying old logic
   - Reads/saves Worker URL from #base + #saveBase, manual refresh #btnPrice
   - Updates #price text and also calls window.setLivePrice(price, meta) if present
   - Fallback chain: <BASE>/price → <BASE>/api/price → <BASE> → gold-ticks endpoints
   - Poll every 1000 ms, pauses when tab hidden
============================================================================= */
(function () {
  try {
    if (window.GSX_MOBILE_GLUE && window.GSX_MOBILE_GLUE.ready) return;
    const NS = (window.GSX_MOBILE_GLUE = window.GSX_MOBILE_GLUE || {});
    NS.ready = true;

    const $ = (s)=>document.querySelector(s);

    const DEFAULT_BASE = 'https://goldsignalsx-worker.samer-mourtada.workers.dev';
    const ALT_BASE = 'https://gold-ticks.samer-mourtada.workers.dev';
    const LS_KEY = 'GSX_BASE_URL';
    const POLL_MS = 1000;

    function getBase(){
      try { return (localStorage.getItem(LS_KEY) || '').trim() || DEFAULT_BASE; } catch { return DEFAULT_BASE; }
    }
    function setBase(url){
      const clean = (url||'').trim().replace(/\/+$/,'') || DEFAULT_BASE;
      try { localStorage.setItem(LS_KEY, clean); } catch {}
      const input = $('#base'); if (input) input.value = clean;
      return clean;
    }

    function normalizePriceJson(j){
      const price = Number(j && (j.price ?? j.close ?? j.last));
      if (!Number.isFinite(price)) return null;
      const symbol = j.symbol || 'XAUUSD';
      const source = j.source || 'gold-ticks';
      const isoTime = j.isoTime || (typeof j.ts==='number' ? new Date(j.ts).toISOString() :
                        (j.date && j.time ? new Date(`${j.date}T${j.time}Z`).toISOString() : null));
      const ts = typeof j.ts==='number' ? j.ts : (isoTime ? Date.parse(isoTime) : Date.now());
      const date = j.date || (isoTime ? isoTime.slice(0,10) : '');
      const time = j.time || (isoTime ? isoTime.slice(11,19) : '');
      return { source, symbol, price, close: price, date, time, isoTime, ts };
    }

    async function fetchPrice(){
      const base = getBase().replace(/\/+$/,'');
      const chain = [
        `${base}/price`,
        `${base}/api/price`,
        base,
        `${ALT_BASE}/price`,
        `${ALT_BASE}/api/price`,
        ALT_BASE
      ];
      for (const u of chain){
        try {
          const r = await fetch(u, { headers:{accept:'application/json'}, cache:'no-store' });
          if (!r.ok) continue;
          const meta = normalizePriceJson(await r.json());
          if (meta) return meta;
        } catch {}
      }
      return null;
    }

    function renderPrice(meta){
      if (!meta) return;
      if (typeof window.setLivePrice === 'function') {
        try { window.setLivePrice(meta.price, meta); } catch {}
      }
      const el = $('#price');
      if (el) el.textContent = (Math.round(meta.price*1000)/1000).toString();
    }

    async function tick(){ renderPrice(await fetchPrice()); }

    let timer = null;
    function start(){ if (timer) return; tick(); timer = setInterval(tick, POLL_MS); }
    function stop(){ if (timer) { clearInterval(timer); timer = null; } }

    function wire(){
      const baseInput = $('#base');
      const saveBtn = $('#saveBase');
      const btnPrice = $('#btnPrice');

      if (baseInput && !baseInput.value) baseInput.value = getBase();
      if (saveBtn) saveBtn.addEventListener('click', ()=> setBase(baseInput ? baseInput.value : ''));
      if (btnPrice) btnPrice.addEventListener('click', tick);
    }

    document.addEventListener('visibilitychange', ()=>{
      if (document.hidden) stop(); else start();
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ()=>{ wire(); start(); });
    } else { wire(); start(); }
  } catch (e) { /* swallow */ }
})();
