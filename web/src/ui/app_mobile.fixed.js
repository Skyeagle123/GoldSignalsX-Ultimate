
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

