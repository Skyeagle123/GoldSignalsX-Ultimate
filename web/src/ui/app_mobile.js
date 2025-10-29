/* GoldSignalsX Mobile full version — includes live price badge integration */

(function () {
  'use strict';
  if (window.GSX && window.GSX.__mobileGlueReady) return;

  const GSX = (window.GSX = window.GSX || {});

  // Base config
  const DEFAULT_BASE = 'https://goldsignalsx-worker.samer-mourtada.workers.dev';
  const LS_KEY = 'GSX_BASE_URL';
  const POLL_MS = 1000;

  GSX.getBase = function () {
    try { return localStorage.getItem(LS_KEY) || DEFAULT_BASE; } catch { return DEFAULT_BASE; }
  };
  GSX.setBase = function (url) {
    if (typeof url === 'string' && url.trim()) {
      try { localStorage.setItem(LS_KEY, url.trim().replace(/\/+$, '')); } catch {}
    }
  };

  GSX.fetchPrice = async function () {
    const base = (GSX.getBase() || '').replace(/\/+$, '');
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

  // ---- UI badge ----
  const GSX_PRICE_URL = DEFAULT_BASE + '/price';

  function gsxMountPriceBadge() {
    let el = document.getElementById('gsx-live-price');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gsx-live-price';
      el.style.cssText = [
        'position:absolute','left:12px','top:10px','z-index:9999',
        'padding:6px 10px','border-radius:12px',
        'background:rgba(0,0,0,.35)','backdrop-filter:blur(4px)',
        'color:#fff','font-weight:700','font-size:14px',
        'box-shadow:0 2px 8px rgba(0,0,0,.2)'
      ].join(';');
      el.textContent = '...';
      document.body.appendChild(el);
    }
    return el;
  }

  async function gsxFetchPriceOnce() {
    const r = await fetch(GSX_PRICE_URL, { cache: 'no-store' });
    const j = await r.json();
    const price  = (j.price ?? j.data?.price);
    const source = (j.source ?? j.data?.source ?? '');
    const ts     =  Number(j.ts ?? j.data?.ts ?? Date.now());
    if (!Number.isFinite(price)) throw new Error('no price');
    return { price, source, ts };
  }

  function gsxStartPricePolling() {
    const el = gsxMountPriceBadge();
    const paint = ({price, source, ts}) => {
      try {
        el.textContent = `${price.toFixed(2)} • ${source||'—'}`;
        el.title = new Date(ts).toLocaleString();
      } catch {}
    };
    const tick = async () => {
      try { paint(await gsxFetchPriceOnce()); }
      catch { el.textContent = '—'; }
    };
    tick();
    return setInterval(tick, 1000);
  }

  // ---- Start polling ----
  window.addEventListener('load', () => {
    try { gsxStartPricePolling(); } catch(e) { console.warn(e); }
  });

  GSX.__mobileGlueReady = true;
})();
