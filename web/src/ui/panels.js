export function plotLine(canvas, series, { grid=true, min=null, max=null, hlines=[], bands=[] }={}){
  if(!canvas || !series || !series.length){ if(canvas){ const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height);} return; }
  const ctx = canvas.getContext('2d'); const W=canvas.clientWidth, H=canvas.clientHeight;
  canvas.width=W*2; canvas.height=H*2; ctx.scale(2,2); ctx.clearRect(0,0,W,H);
  const n=series.length; const vis=Math.min(n,160); const arr=series.slice(-vis);
  const lo = (min!=null)? min : Math.min(...arr); const hi=(max!=null)? max : Math.max(...arr);
  const pad=(hi-lo)||1e-6; const xStep=W/(vis-1||1); const y=v=> H - ((v-lo)/pad)*H; const x=i=> i*xStep;
  if(grid){ const gridColor=getComputedStyle(document.documentElement).getPropertyValue('--line').trim(); ctx.strokeStyle=gridColor||'#1f2937'; ctx.lineWidth=1; for(let i=0;i<4;i++){ const yy=i*(H/3); ctx.beginPath(); ctx.moveTo(0,yy); ctx.lineTo(W,yy); ctx.stroke(); } }
  // shaded bands
  for(const b of bands){ const y1 = y(b.from), y2 = y(b.to); ctx.fillStyle = b.fill || 'rgba(148,163,184,0.12)'; ctx.fillRect(0, Math.min(y1,y2), W, Math.abs(y2-y1)); }
  ctx.strokeStyle='#e5e7eb'; ctx.lineWidth=2; ctx.beginPath();
  for(let i=0;i<arr.length;i++){ const xx=x(i), yy=y(arr[i]); if(i==0) ctx.moveTo(xx,yy); else ctx.lineTo(xx,yy);} ctx.stroke();
  for(const h of hlines){ ctx.strokeStyle=h.color||'#6b7280'; ctx.setLineDash([5,5]); const yy=y(h.y); ctx.beginPath(); ctx.moveTo(0,yy); ctx.lineTo(W,yy); ctx.stroke(); ctx.setLineDash([]); }
}
export function plotMACD(canvas, macdSeries, signalSeries, histSeries){
  if(!canvas || !macdSeries || !signalSeries || macdSeries.length<2) return;
  const ctx = canvas.getContext('2d'); const W=canvas.clientWidth, H=canvas.clientHeight;
  canvas.width=W*2; canvas.height=H*2; ctx.scale(2,2); ctx.clearRect(0,0,W,H);
  const n=macdSeries.length; const vis=Math.min(n,160);
  const m=macdSeries.slice(-vis), s=signalSeries.slice(-vis), h=histSeries? histSeries.slice(-vis):[];
  const lo=Math.min(...m, ...s, 0), hi=Math.max(...m, ...s, 0); const pad=(hi-lo)||1e-6;
  const xStep=W/(vis-1||1); const y=v=> H - ((v-lo)/pad)*H; const x=i=> i*xStep;
  // grid + zero line
  const gridColor=getComputedStyle(document.documentElement).getPropertyValue('--line').trim(); ctx.strokeStyle=gridColor||'#1f2937'; ctx.lineWidth=1; for(let i=0;i<4;i++){ const yy=i*(H/3); ctx.beginPath(); ctx.moveTo(0,yy); ctx.lineTo(W,yy); ctx.stroke(); }
  ctx.strokeStyle='#6b7280'; ctx.setLineDash([5,5]); ctx.beginPath(); ctx.moveTo(0,y(0)); ctx.lineTo(W,y(0)); ctx.stroke(); ctx.setLineDash([]);
  // histogram
  if(h.length){ const bw=Math.max(2, xStep*0.6); for(let i=0;i<h.length;i++){ ctx.fillStyle=(h[i]>=0)?'#10b981':'#ef4444'; const xx=x(i)-bw/2; const yy=y(h[i]); const y0=y(0); ctx.fillRect(xx, Math.min(yy,y0), bw, Math.abs(y0-yy)); } }
  // lines
  ctx.strokeStyle='#e5e7eb'; ctx.lineWidth=2; ctx.beginPath(); for(let i=0;i<m.length;i++){ const xx=x(i), yy=y(m[i]); if(i==0) ctx.moveTo(xx,yy); else ctx.lineTo(xx,yy);} ctx.stroke();
  ctx.strokeStyle='#60a5fa'; ctx.lineWidth=2; ctx.beginPath(); for(let i=0;i<s.length;i++){ const xx=x(i), yy=y(s[i]); if(i==0) ctx.moveTo(xx,yy); else ctx.lineTo(xx,yy);} ctx.stroke();
}
