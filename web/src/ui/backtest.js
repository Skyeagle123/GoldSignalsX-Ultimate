export function runBacktest(bars, params){
  if (!bars || bars.length<50) return { trades:0, pl:0, win:0, maxDD:0 };
  const atr = avgATR(bars, 14); const K=params?.atrMult||1.3;
  let pl=0, maxDD=0, peak=0, wins=0, trades=0;
  for (let i=30;i<bars.length-2;i++){
    const dir = momentum(bars, i); if (!dir) continue;
    const entry = bars[i+1].c; const sl = dir>0? entry-K*atr : entry+K*atr; const tp = dir>0? entry+2*K*atr : entry-2*K*atr;
    const path = [bars[i+1], bars[i+2]]; let closed=null;
    for (const b of path){
      if (dir>0){ if (b.l<=sl){closed=sl-entry;break;} if (b.h>=tp){closed=tp-entry;break;} }
      else { if (b.h>=sl){closed=entry-sl;break;} if (b.l<=tp){closed=entry-tp;break;} }
    }
    if (closed==null) closed=(bars[i+2].c-entry)*(dir>0?1:-1);
    pl+=closed; trades++; if (closed>0) wins++; peak=Math.max(peak,pl); maxDD=Math.min(maxDD, pl-peak);
  }
  const win=trades? wins/trades*100 : 0; return { trades, pl:+pl.toFixed(2), win:+win.toFixed(1), maxDD:+maxDD.toFixed(2) };
}
function momentum(bars,i){ if (i<35) return 0; const c=bars.map(b=>b.c); const ema=(arr,p)=>{ const k=2/(p+1); let e=arr[i-p+1]; for(let j=i-p+2;j<=i;j++){ e=arr[j]*k + e*(1-k);} return e; }; const f=ema(c,12), s=ema(c,26); return f>s?+1:f<s?-1:0; }
function avgATR(bars,p){ let s=0,cnt=0; for(let i=1;i<bars.length;i++){ const h=bars[i].h, l=bars[i].l, cPrev=bars[i-1].c; const tr=Math.max(h-l, Math.abs(h-cPrev), Math.abs(l-cPrev)); s+=tr; cnt++; } return s/Math.max(1,cnt) || 1; }
