export async function fetchPrice(base){ const r=await fetch(`${base}/price`,{cache:'no-store'}); if(!r.ok) throw new Error('price '+r.status); return r.json(); }
export async function fetchBars(base, tf='1m', limit=1200){ const r=await fetch(`${base}/bars?tf=${encodeURIComponent(tf)}&limit=${encodeURIComponent(limit)}`,{cache:'no-store'}); if(!r.ok) throw new Error('bars '+r.status); return r.json(); }
export function exportCSV(base, tf='1m'){ window.open(`${base}/export.csv?tf=${encodeURIComponent(tf)}`,'_blank'); }
export async function notifyTelegram(base, payload){ const r=await fetch(`${base}/notify`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}); if(!r.ok) throw new Error('notify '+r.status); return r.json(); }
export async function logDecision(base, payload){ await fetch(`${base}/decision`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}); }
