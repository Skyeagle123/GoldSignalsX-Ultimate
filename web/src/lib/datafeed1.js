/**
 * GSX Mobile — datafeed wired to your unified Cloudflare Worker.
 * Endpoints expected:
 *   GET  /price                  → { ok, price, ts, source? }
 *   GET  /bars?tf=1m&limit=1200  → [{t,o,h,l,c,v}]
 *   GET  /export.csv?tf=1m       → CSV download
 *   POST /notify                 → { ok }
 *   POST /decision               → { ok }
 */

function normBase(base){
  if(!base) throw new Error('ضع رابط الووركر أولاً');
  return String(base).replace(/\/+$/,''); // trim trailing slashes
}

function toJSON(r){
  if(!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
}

export async function fetchPrice(base){
  const B = normBase(base);
  // Try /price, then /api/price (compatible with gold-ticks), then root if it returns JSON
  const candidates = [`${B}/price`, `${B}/api/price`, `${B}`];
  let lastErr = null;
  for(const u of candidates){
    try{
      const j = await fetch(u, { headers: { 'accept':'application/json' }, cache:'no-store' }).then(toJSON);
      const price = Number(j.price ?? j.close ?? j.last);
      const ts = Number(j.ts ?? Date.parse(j.time||j.isoTime) || Date.now());
      if(Number.isFinite(price)){ return { price, ts, source: j.source || 'worker' }; }
    }catch(e){ lastErr = e; }
  }
  throw lastErr || new Error('price_failed');
}

export async function fetchBars(base, tf='1m', limit=1200){
  const B = normBase(base);
  const url = `${B}/bars?tf=${encodeURIComponent(tf)}&limit=${encodeURIComponent(limit)}`;
  const arr = await fetch(url, { cache:'no-store' }).then(toJSON);
  // Normalize fields to numbers
  return (Array.isArray(arr)?arr:[]).map(b => ({
    t: +b.t, o:+b.o, h:+b.h, l:+b.l, c:+b.c, v:+(b.v ?? 0)
  }));
}

export function exportCSV(base, tf='1m'){
  const B = normBase(base);
  const url = `${B}/export.csv?tf=${encodeURIComponent(tf)}`;
  try {
    // Open in a new tab to trigger download in browsers
    window.open(url, '_blank', 'noopener');
  } catch(e){
    // As fallback, navigate
    location.href = url;
  }
}

export async function notifyTelegram(base, payload){
  const B = normBase(base);
  const r = await fetch(`${B}/notify`, {
    method: 'POST',
    headers: { 'content-type':'application/json' },
    body: JSON.stringify(payload || { text: 'GSX alert' })
  });
  const j = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error('notify failed ' + r.status);
  return j;
}

export async function logDecision(base, payload){
  const B = normBase(base);
  const r = await fetch(`${B}/decision`, {
    method: 'POST',
    headers: { 'content-type':'application/json' },
    body: JSON.stringify(payload || {})
  });
  const j = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error('decision log failed ' + r.status);
  return j;
}
