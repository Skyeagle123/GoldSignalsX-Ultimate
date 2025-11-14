export function drawChart(canvas, bars, live, markers, opts){
  if (!canvas || !bars || bars.length===0) return;
  const ctx = canvas.getContext('2d'); const W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W*2; canvas.height = H*2; ctx.scale(2,2); ctx.clearRect(0,0,W,H);
  const n = Math.min(bars.length, 160); const arr = bars.slice(-n);
  const patternList = (opts && opts.patterns && opts.patterns.on)? (opts.patterns.list||[]) : [];
  const highs = arr.map(b=>b.h), lows = arr.map(b=>b.l);
  const maxH = Math.max(...highs, live||-Infinity); const minL = Math.min(...lows, live|| Infinity);
  const pad = (maxH-minL)*0.1; const hi = maxH+pad, lo = minL-pad;
  const xStep = W / n; const y = (p)=> H - ( (p - lo) / (hi - lo) ) * H; const x = (i)=> i*xStep + xStep*0.5;
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--line'); ctx.lineWidth = 1; for (let i=0;i<5;i++){ const yy = i*(H/4); ctx.beginPath(); ctx.moveTo(0,yy); ctx.lineTo(W,yy); ctx.stroke(); }
  for (let i=0;i<arr.length;i++){ const b = arr[i]; const cx = x(i);
    ctx.strokeStyle = '#94a3b8'; ctx.beginPath(); ctx.moveTo(cx, y(b.h)); ctx.lineTo(cx, y(b.l)); ctx.stroke();
    const color = b.c>=b.o ? '#10b981' : '#ef4444'; ctx.fillStyle = color;
    const bw = Math.max(2, xStep*0.5); const by = y(Math.max(b.o,b.c)); const bh = Math.max(1, Math.abs(y(b.c)-y(b.o)));
    ctx.fillRect(cx-bw/2, by, bw, bh);
  }
  // Bollinger Bands
  if (opts && opts.bb && opts.bb.on){ drawBB(ctx, bars.slice(-n), xStep, x, y, W); }
  drawPatternMarkers(ctx, arr, patternList, (i)=>x(i), y);
  if (markers){ if (markers.entry) drawH(ctx, y(markers.entry), W, '#e5e7eb'); if (markers.sl) drawH(ctx, y(markers.sl), W, '#ef4444');
                if (markers.tp1) drawH(ctx, y(markers.tp1), W, '#10b981'); if (markers.tp2) drawH(ctx, y(markers.tp2), W, '#10b981'); }
  if (live){ const yy = y(live); ctx.strokeStyle = '#60a5fa'; ctx.fillStyle = '#0ea5e9';
    ctx.beginPath(); ctx.moveTo(W-80, yy); ctx.lineTo(W, yy); ctx.stroke();
    const text = `Live: ${live.toFixed(2)}`; ctx.font = '12px system-ui'; const w = ctx.measureText(text).width + 10;
    ctx.fillStyle = '#0ea5e9'; roundRect(ctx, W-80-w-8, yy-12, w, 20, 10, true); ctx.fillStyle = '#0b0f17'; ctx.fillText(text, W-80-w-3, yy+4); }
}
function drawH(ctx, y, W, color){ ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([6,6]); ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); ctx.setLineDash([]); }
function roundRect(ctx, x, y, w, h, r, fill){ ctx.beginPath(); ctx.moveTo(x+r, y); ctx.arcTo(x+w, y,   x+w, y+h, r); ctx.arcTo(x+w, y+h, x,   y+h, r); ctx.arcTo(x,   y+h, x,   y,   r); ctx.arcTo(x,   y,   x+w, y,   r); if (fill) ctx.fill(); else ctx.stroke(); }

function drawBB(ctx, bars, xStep, x, y, W){
  const closes = bars.map(b=>b.c);
  const period = 20, k = 2;
  const sma = (arr,p,i)=>{ let s=0; for(let j=i-p+1;j<=i;j++) s+=arr[j]; return s/p; };
  const stdev = (arr,p,i,m)=>{ let ss=0; for(let j=i-p+1;j<=i;j++){ const d=arr[j]-m; ss+=d*d; } return Math.sqrt(ss/p); };
  const upper=[], lower=[], mid=[];
  for(let i=0;i<closes.length;i++){
    if(i>=period-1){ const m=sma(closes,period,i); const sd=stdev(closes,period,i,m); mid.push(m); upper.push(m+k*sd); lower.push(m-k*sd);} else { mid.push(null); upper.push(null); lower.push(null);} }
  ctx.lineWidth=1.5;
  // upper
  ctx.strokeStyle='#60a5fa'; ctx.beginPath(); for(let i=0;i<upper.length;i++){ if(upper[i]==null) continue; const xx = x(i); const yy = y(upper[i]); if(i===period-1) ctx.moveTo(xx,yy); else ctx.lineTo(xx,yy);} ctx.stroke();
  // lower
  ctx.strokeStyle='#60a5fa'; ctx.beginPath(); for(let i=0;i<lower.length;i++){ if(lower[i]==null) continue; const xx = x(i); const yy = y(lower[i]); if(i===period-1) ctx.moveTo(xx,yy); else ctx.lineTo(xx,yy);} ctx.stroke();
  // mid
  ctx.strokeStyle='#f59e0b'; ctx.beginPath(); for(let i=0;i<mid.length;i++){ if(mid[i]==null) continue; const xx = x(i); const yy = y(mid[i]); if(i===period-1) ctx.moveTo(xx,yy); else ctx.lineTo(xx,yy);} ctx.stroke();
}

function emaSeries(closes, period){
  const out=[]; if(closes.length<period) return out;
  const k=2/(period+1); let e=0; let sum=0;
  for(let i=0;i<closes.length;i++){
    const v=closes[i];
    if(i<period){ sum+=v; if(i===period-1){ e=sum/period; out.push(e);} else { out.push(null);} }
    else { e = v*k + e*(1-k); out.push(e); }
  }
  return out;
}
function drawEMA(ctx, closes, x, y, period, color){
  const s=emaSeries(closes, period); if(!s.length) return;
  ctx.strokeStyle=color; ctx.lineWidth=1.8; ctx.beginPath();
  for(let i=0;i<s.length;i++){ const v=s[i]; if(v==null) continue; const xx=x(i), yy=y(v); if(i===0||s[i-1]==null) ctx.moveTo(xx,yy); else ctx.lineTo(xx,yy); }
  ctx.stroke();
}
function drawLegend(ctx, W, regime, mode, flags){
  const text = `حالة: ${regime} • وضع: ${mode} • BB:${flags.bb?'On':'Off'} • EMA:${flags.ema?'On':'Off'} • Stoch:${flags.stoch?'On':'Off'} • RSI:${flags.rsi?'On':'Off'}`;
  ctx.font='12px system-ui'; const pad=8; const w=ctx.measureText(text).width + pad*2; const h=24;
  ctx.fillStyle='rgba(15,23,42,0.85)'; ctx.strokeStyle='#334155'; ctx.lineWidth=1; roundRect(ctx, 8, 8, Math.min(w, W-16), h, 8, true); ctx.stroke();
  ctx.fillStyle='#e5e7eb'; ctx.fillText(text, 8+pad, 8+h-8);
}

function drawPatternMarkers(ctx, arr, list, x, y){
  if(!list || !list.length) return;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  for(const p of list){
    const i = p.i; if(i<0 || i>=arr.length) continue;
    const b = arr[i];
    const cx = x(i);
    const symbol = p.kind==='bull' ? '▲' : p.kind==='bear' ? '▼' : '◆';
    const yy = p.kind==='bull' ? y(b.l) + 12 : p.kind==='bear' ? y(b.h) - 12 : y((b.h+b.l)/2);
    ctx.fillStyle = p.kind==='bull' ? '#22c55e' : p.kind==='bear' ? '#ef4444' : '#f59e0b';
    ctx.font='14px system-ui';
    ctx.fillText(symbol, cx, yy);
  }
}
