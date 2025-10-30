
// ---- GSX injected: resilient price fetcher (kept minimal, no removals) ----
async function fetchJSONWithFallback(urls) {
  let lastErr;
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { accept: 'application/json' }, cache: 'no-store' });
      if (!r.ok) { lastErr = new Error('HTTP '+r.status); continue; }
      return await r.json();
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('All sources failed');
}


/* GoldSignalsX Mobile glue (namespaced, safe to include twice)
   - Polls the unified Worker (/price) and updates UI
   - Falls back automatically if endpoint switches between /price and /api/price
   - No global `let l` or similar — everything inside GSX namespace/IIFE
*/

(function () {
  'use strict';

  // Avoid redefining if script is injected twice
  if (window.GSX && window.GSX.__mobileGlueReady) return;
  if (window.__GSX_GLUE_V2_READY__) return;

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
      // mirror default #price and #liveDateTime if they exist
      try {
        const elPrice2 = document.getElementById('price');
        if (elPrice2) elPrice2.textContent = (Math.round(meta.price * 1000) / 1000).toString();
        const dt = document.getElementById('liveDateTime');
        if (dt) {
          const baseTs = meta.isoTime || meta.ts || Date.now();
          const d = new Date(baseTs);
          const pad = (n)=> String(n).padStart(2,'0');
          dt.textContent = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        }
      } catch {}
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


/* === GSX MOBILE GLUE v2 (non-invasive) =======================================
   - لا يغيّر أي شيء عندك؛ فقط يضيف polling للسعر + ربط مع عناصر صفحتك
   - يحاول BASE بالترتيب: userBase → آخر Base نجح → goldsignalsx-worker → gold-ticks
   - لكل Base: /price → /api/price → الجذر (يتوقّع JSON فيه price/close/last)
   - يحدّث #price ويستدعي window.setLivePrice(price, meta) إذا موجودة
   - يتوقّف مع إخفاء التبويب ويعود تلقائيًا عند الرجوع
============================================================================== */
(function () {
  'use strict';
  if (window.__GSX_GLUE_V2_READY__) return;
  window.__GSX_GLUE_V2_READY__ = true;

  // DOM helpers
  const $ = (s) => document.querySelector(s);

  // مصادر أساسية
  const DEFAULTS = [
    'https://goldsignalsx-worker.samer-mourtada.workers.dev',
    'https://gold-ticks.samer-mourtada.workers.dev'
  ];
  const POLL_MS = 1000; // 1s
  const LS_KEY  = 'GSX_BASE_URL';

  // عناصر من صفحتك (index.html)
  const elBase  = $('#base');   // حقل الـ Worker URL عندك
  const elPrice = $('#price');  // مكان السعر عندك
  const btnPrice = $('#btnPrice'); // زر تحديث السعر (إن وجد)

  // قراءة/حفظ العنوان
  function getSavedBase() {
    try { return (localStorage.getItem(LS_KEY) || '').trim(); } catch { return ''; }
  }
  function setSavedBase(v) {
    const clean = String(v||'').trim().replace(/\/+$/,'');
    try { localStorage.setItem(LS_KEY, clean); } catch {}
    if (elBase) elBase.value = clean;
    return clean;
  }

  // استرجاع الـ Base من الواجهة/المخزن
  function getUserBase() {
    const fromUI = (elBase && elBase.value || '').trim();
    const fromLS = getSavedBase();
    return (fromUI || fromLS || '').replace(/\/+$/,'');
  }

  // توحيد شكل الرد للـ gold-ticks
  function normalizePriceJson(j) {
    const price = Number(j?.price ?? j?.close ?? j?.last);
    if (!Number.isFinite(price)) return null;
    const source = j?.source || 'gold-ticks';
    const isoTime = j?.isoTime
      || (typeof j?.ts === 'number' ? new Date(j.ts).toISOString()
          : (j?.date && j?.time ? new Date(`${j.date}T${j.time}Z`).toISOString() : null));
    const ts = (typeof j?.ts === 'number') ? j.ts : (isoTime ? Date.parse(isoTime) : Date.now());
    return { price, source, ts };
  }

  async function tryOneBase(base) {
    const candidates = [`${base}/price`, `${base}/api/price`, base];
    for (const u of candidates) {
      try {
        const r = await fetch(u, { headers:{ accept:'application/json' }, cache:'no-store' });
        if (!r.ok) continue;
        const j = await r.json().catch(()=> ({}));
        const meta = normalizePriceJson(j);
        if (meta) { meta.source = meta.source || (u.includes('gold-ticks') ? 'gold-ticks' : 'worker'); return meta; }
      } catch { /* next */ }
    }
    return null;
  }

  async function fetchUnifiedPrice() {
    const bases = [];
    const user = getUserBase();
    if (user) bases.push(user);

    // آخر Base نجح (جلسة سابقة)
    const lastOk = (window.__GSX_LAST_OK_BASE__ || '');
    if (lastOk && !bases.includes(lastOk)) bases.push(lastOk);

    // defaults
    for (const d of DEFAULTS) if (!bases.includes(d)) bases.push(d);

    // جرّب بالتسلسل
    for (const b of bases) {
      const meta = await tryOneBase(b);
      if (meta) {
        window.__GSX_LAST_OK_BASE__ = b;
        if (!user) setSavedBase(b);
        return meta;
      }
    }

    // آخر حل: stooq (CSV)
    try {
      const r = await fetch('https://stooq.com/q/l/?s=xauusd&f=sd2t2ohlcvn&h&e=csv', { cache:'no-store' });
      if (!r.ok) throw 0;
      const csv = await r.text();
      const row = (csv.trim().split(/\r?\n/)[1] || '').split(',');
      const close = Number(row[6]);
      if (!Number.isFinite(close)) throw 0;
      const ts = Date.parse((row[1]||'')+'T'+(row[2]||'')+'Z') || Date.now();
      return { price: close, ts, source: 'stooq' };
    } catch { return null; }
  }

  function updateUI(meta) {
    if (!meta) {
      if (elPrice) elPrice.textContent = '—';
      return;
    }
    // لو عندك هوك عالمي يشغّل باقي الواجهة
    if (typeof window.setLivePrice === 'function') {
      try { window.setLivePrice(meta.price, meta); } catch {}
    }
    // حدّث مكان السعر بالصفحة (كما في index.html)
    if (elPrice) elPrice.textContent = (Math.round(meta.price*1000)/1000).toString();
    (function(){
      const dt = document.getElementById('liveDateTime');
      if (!dt) return;
      try {
        const baseTs = meta.isoTime || meta.ts || Date.now();
        const d = new Date(baseTs);
        const pad = (n)=> String(n).padStart(2,'0');
        dt.textContent = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      } catch {}
    })();
  }

  let timer = null;
  async function tick() {
    const meta = await fetchUnifiedPrice();
    window.__GSX_LAST_META__ = meta;
    updateUI(meta);
  }
  function start() {
    if (timer) return;
    tick();
    timer = setInterval(tick, POLL_MS);
  }
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  // أسلاك الواجهة (إن وُجدت)
  if (elBase) {
    elBase.addEventListener('change', () => setSavedBase(elBase.value));
    if (!elBase.value) elBase.value = getUserBase() || DEFAULTS[0];
  }
  if (btnPrice) btnPrice.addEventListener('click', tick);

  // وفّر دوال يدوية (اختياري)
  window.GSX_GLUE = Object.assign(window.GSX_GLUE || {}, {
    start, stop, tick,
    setBase: setSavedBase,
    getBase: getUserBase
  });

  // إيقاف/استئناف مع رؤية الصفحة
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });

  // تشغيل تلقائي
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();



// ---- GSX injected: setPriceFromWorker uses worker then gold-ticks ----
async function setPriceFromWorker(base) {
  const b = (base || '').replace(/\/$/, '');
  const urls = [
    b + '/price', b + '/api/price', b,
    'https://gold-ticks.samer-mourtada.workers.dev/price'
  ];
  try {
    const j = await fetchJSONWithFallback(urls);
    const price = Number(j.price ?? j.last ?? j.close);
    if (Number.isFinite(price)) {
      const el = document.getElementById('livePrice') || document.querySelector('[data-role="live-price"]');
      if (el) {
        el.textContent = price.toFixed(3);
        const ts = Number(j.ts) || Date.now();
        el.setAttribute('data-ts', String(ts));
      }
    }
  } catch (e) {
    console.warn('price fetch failed', e);
  }
}



/* ================= GSX MOBILE GLUE (non-invasive) =================
   - Appends resilient live-price polling without removing or changing
     any of your existing code.
   - Tries the Worker base you put in the UI/localStorage first,
     then falls back to goldsignalsx-worker, then gold-ticks, then stooq.
   - Updates #price (and #liveDateTime if present) and calls
     window.setLivePrice(price, meta) if your app defines it.
=================================================================== */

(function () {
  'use strict';
  if (window.__GSX_GLUE_V2_READY__) return;
  window.__GSX_GLUE_V2_READY__ = true;

  const $ = (s) => document.querySelector(s);

  const DEFAULTS = [
    'https://goldsignalsx-worker.samer-mourtada.workers.dev',
    'https://gold-ticks.samer-mourtada.workers.dev'
  ];
  const POLL_MS = 1000;
  const LS_KEY  = 'GSX_BASE_URL';

  const elBase  = $('#base');
  const elPrice = $('#price');
  const btnPrice = $('#btnPrice');

  function getSavedBase() {
    try { return (localStorage.getItem(LS_KEY) || '').trim(); } catch { return ''; }
  }
  function setSavedBase(v) {
    const clean = String(v||'').trim().replace(/\/+$/,'');
    try { localStorage.setItem(LS_KEY, clean); } catch {}
    if (elBase) elBase.value = clean;
    return clean;
  }
  function getUserBase() {
    const fromUI = (elBase && elBase.value || '').trim();
    const fromLS = getSavedBase();
    return (fromUI || fromLS || '').replace(/\/+$/,'');
  }

  function normalizePriceJson(j) {
    const price = Number(j?.price ?? j?.close ?? j?.last);
    if (!Number.isFinite(price)) return null;
    const source = j?.source || 'gold-ticks';
    const isoTime = j?.isoTime
      || (typeof j?.ts === 'number' ? new Date(j.ts).toISOString()
          : (j?.date && j?.time ? new Date(`${j.date}T${j.time}Z`).toISOString() : null));
    const ts = (typeof j?.ts === 'number') ? j.ts : (isoTime ? Date.parse(isoTime) : Date.now());
    return { price, source, ts, isoTime };
  }

  async function tryOneBase(base) {
    const candidates = [`${base}/price`, `${base}/api/price`, base];
    for (const u of candidates) {
      try {
        const r = await fetch(u, { headers:{ accept:'application/json' }, cache:'no-store' });
        if (!r.ok) continue;
        const j = await r.json().catch(()=> ({}));
        const meta = normalizePriceJson(j);
        if (meta) { meta.source = meta.source || (u.includes('gold-ticks') ? 'gold-ticks' : 'worker'); return meta; }
      } catch { /* next */ }
    }
    return null;
  }

  async function fetchUnifiedPrice() {
    const bases = [];
    const user = getUserBase();
    if (user) bases.push(user);

    const lastOk = (window.__GSX_LAST_OK_BASE__ || '');
    if (lastOk && !bases.includes(lastOk)) bases.push(lastOk);

    for (const d of DEFAULTS) if (!bases.includes(d)) bases.push(d);

    for (const b of bases) {
      const meta = await tryOneBase(b);
      if (meta) {
        window.__GSX_LAST_OK_BASE__ = b;
        if (!user) setSavedBase(b);
        return meta;
      }
    }

    try {
      const r = await fetch('https://stooq.com/q/l/?s=xauusd&f=sd2t2ohlcvn&h&e=csv', { cache:'no-store' });
      if (!r.ok) throw 0;
      const csv = await r.text();
      const row = (csv.trim().split(/\r?\n/)[1] || '').split(',');
      const close = Number(row[6]);
      if (!Number.isFinite(close)) throw 0;
      const ts = Date.parse((row[1]||'')+'T'+(row[2]||'')+'Z') || Date.now();
      return { price: close, ts, source: 'stooq' };
    } catch { return null; }
  }

  function updateUI(meta) {
    if (!meta) {
      if (elPrice) elPrice.textContent = '—';
      return;
    }
    if (typeof window.setLivePrice === 'function') {
      try { window.setLivePrice(meta.price, meta); } catch {}
    }
    if (elPrice) elPrice.textContent = (Math.round(meta.price*1000)/1000).toString();
    const dt = document.getElementById('liveDateTime');
    if (dt) {
      try {
        const baseTs = meta.isoTime || meta.ts || Date.now();
        const d = new Date(baseTs);
        const pad = (n)=> String(n).padStart(2,'0');
        dt.textContent = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      } catch {}
    }
  }

  let timer = null;
  async function tick() {
    const meta = await fetchUnifiedPrice();
    window.__GSX_LAST_META__ = meta;
    updateUI(meta);
  }
  function start() {
    if (timer) return;
    tick();
    timer = setInterval(tick, POLL_MS);
  }
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  if (elBase) {
    elBase.addEventListener('change', () => setSavedBase(elBase.value));
    if (!elBase.value) elBase.value = getUserBase() || DEFAULTS[0];
  }
  if (btnPrice) btnPrice.addEventListener('click', tick);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();


// === GSX unified price helpers (non-breaking add) ===
async function unifiedFetchJSON(endpoints, {timeoutMs = 3500, headers} = {}) {
  const ctrl = new AbortController();
  const to = setTimeout(()=>ctrl.abort('timeout'), timeoutMs);
  try {
    for (const url of endpoints) {
      try {
        const r = await fetch(url, {headers, signal: ctrl.signal, cache: 'no-store'});
        if (!r.ok) continue;
        return await r.json();
      } catch (_) { /* try next */ }
    }
    return null;
  } finally {
    clearTimeout(to);
  }
}
function normPrice(obj){
  if (!obj) return null;
  const p = Number(obj.price ?? obj.close ?? obj.last);
  if (!Number.isFinite(p)) return null;
  const ts = Number(obj.ts) || Date.now();
  return { price: p, ts, source: obj.source || 'unknown' };
}
function uiWorkerBase(){
  const el = document.querySelector('#workerUrl,input[name="worker"],.worker-url');
  const val = el && (el.value || el.textContent || '').trim();
  if (!val) return '';
  return val.replace(/\/+$/,'');
}
function priceEndpoints(){
  const base = uiWorkerBase();
  const list = [];
  if (base) list.push(`${base}/price`, `${base}/api/price`, base);
  list.push(
    'https://goldsignalsx-worker.samer-mourtada.workers.dev/price',
    'https://gold-ticks.samer-mourtada.workers.dev/price'
  );
  return list;
}
async function getUnifiedPrice(){
  const eps = priceEndpoints();
  const j = await unifiedFetchJSON(eps, {timeoutMs: 4000, headers:{'accept':'application/json'}});
  return normPrice(j);
}


// === GSX price label refresher (non-breaking add) ===
async function refreshLivePriceLabel(){
  try{
    const out = await getUnifiedPrice();
    if (!out) return;
    const lbl = document.getElementById('livePrice') || document.querySelector('.live-price, #priceLabel');
    if (lbl){
      lbl.textContent = out.price.toFixed(3);
      lbl.setAttribute('data-ts', String(out.ts));
    }
  }catch(e){}
}
try{
  if (!window.__gsxPriceTimer){
    window.__gsxPriceTimer = setInterval(refreshLivePriceLabel, 4000);
    refreshLivePriceLabel();
  }
}catch(_){}


// === GSX bars fetcher (non-breaking add) ===
async function gsxLoadBarsOnce() {
  try {
    const base  = (document.querySelector('#workerUrl')?.value || '').trim().replace(/\/+$/,'');
    const tfBtn = document.querySelector('button[data-tf].active') || document.querySelector('button[data-tf="1m"]');
    const tf    = tfBtn ? (tfBtn.getAttribute('data-tf') || '1m') : '1m';
    const limEl = document.querySelector('#limitInput');
    const limit = Number(limEl?.value || 1200);
    if (!base) { console.warn('GSX: worker URL empty'); return; }
    const u = `${base}/bars?tf=${encodeURIComponent(tf)}&limit=${limit}`;
    const r = await fetch(u, { headers:{'accept':'application/json'} });
    if (!r.ok) throw new Error(`/bars ${r.status}`);
    const bars = await r.json();
    window.gsx = window.gsx || {};
    window.gsx.lastBars = bars;
    window.dispatchEvent(new CustomEvent('gsx:bars', { detail: { tf, limit, bars } }));
  } catch (e) {
    console.error('GSX bars error:', e);
  }
}
// bind button if exists
(function () {
  const btn = document.querySelector('#btnFetch');
  if (btn && !btn.__gsxBound) {
    btn.__gsxBound = true;
    btn.addEventListener('click', gsxLoadBarsOnce);
  }
})();


// === GSX candles render (non-breaking add) ===
(function () {
  function toCandleData(bars) {
    return bars.map(b => ({
      time: Math.floor((b.t || b.time || b.ts) / 1000),
      open:  b.o, high: b.h, low: b.l, close: b.c
    }));
  }
  function renderCandles(bars) {
    const el = document.getElementById('chart');
    if (!el) { console.warn('GSX: #chart not found'); return; }
    window.gsx = window.gsx || {};
    if (!window.gsx.lw) {
      const chart = LightweightCharts.createChart(el, {
        height: 420,
        layout: { background: { type: 'solid', color: '#0b0f14' }, textColor: '#e6e6e6' },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false }
      });
      const series = chart.addCandlestickSeries();
      window.gsx.lw = { chart, series };
    }
    window.gsx.lw.series.setData(toCandleData(bars));
  }
  function handleBars(bars) {
    if (typeof computeAndRender === 'function') {
      try { computeAndRender(bars); return; } catch (e) { console.warn('computeAndRender error:', e); }
    }
    renderCandles(bars);
  }
  window.addEventListener('gsx:bars', (e) => {
    const bars = e?.detail?.bars || [];
    if (bars.length) handleBars(bars);
  });
  if (window.gsx?.lastBars?.length) handleBars(window.gsx.lastBars);
})();
