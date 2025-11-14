function sma(arr, p){ if(arr.length<p) return null; let s=0; for(let i=arr.length-p;i<arr.length;i++) s+=arr[i]; return s/p; }
export function ema(arr, p){ if(arr.length<p) return null; const k=2/(p+1); let e=sma(arr,p); for(let i=arr.length-p+1;i<arr.length;i++){ e = arr[i]*k + e*(1-k);} return e; }
function stdev(arr, p){ if(arr.length<p) return null; const m=sma(arr,p); let ss=0; for(let i=arr.length-p;i<arr.length;i++){ const d=arr[i]-m; ss+=d*d; } return Math.sqrt(ss/p); }

export function computeATR(bars, period=14){
  if(!bars||bars.length<period+1) return null;
  const trs=[]; for(let i=1;i<bars.length;i++){ const h=bars[i].h, l=bars[i].l, cPrev=bars[i-1].c; const tr=Math.max(h-l, Math.abs(h-cPrev), Math.abs(l-cPrev)); trs.push(tr); }
  let atr=sma(trs.slice(0,period),period); for(let i=period;i<trs.length;i++){ atr=((atr*(period-1))+trs[i])/period; } return atr;
}
export function computeBB(closes, period=20, stdK=2){
  const m=sma(closes,period), sd=stdev(closes,period); if(m==null||sd==null) return null;
  return { ma:m, upper:m+stdK*sd, lower:m-stdK*sd, width:(2*stdK*sd)/(m||1) };
}
export function computeADX(bars, period=14){
  if (!bars||bars.length<period+1) return null;
  let trArr=[], plusDM=[], minusDM=[];
  for(let i=1;i<bars.length;i++){
    const cur=bars[i], prev=bars[i-1];
    const up=cur.h-prev.h, dn=prev.l-cur.l;
    const pdm=(up>dn && up>0)?up:0, ndm=(dn>up && dn>0)?dn:0;
    const tr=Math.max(cur.h-cur.l, Math.abs(cur.h-prev.c), Math.abs(cur.l-prev.c));
    plusDM.push(pdm); minusDM.push(ndm); trArr.push(tr);
  }
  const smooth=(arr,p)=>{ let s=arr.slice(0,p).reduce((a,b)=>a+b,0); const out=[s]; for(let i=p;i<arr.length;i++){ s=out[out.length-1] - (out[out.length-1]/p) + arr[i]; out.push(s);} return out; };
  const trS=smooth(trArr,period), plusS=smooth(plusDM,period), minusS=smooth(minusDM,period);
  const diP=plusS.map((v,i)=>100*(v/trS[i])), diM=minusS.map((v,i)=>100*(v/trS[i]));
  const dx=diP.map((p,i)=>100*(Math.abs(p-diM[i])/Math.max(p+diM[i],1e-9)));
  let adx=dx.slice(0,period).reduce((a,b)=>a+b,0)/period; for(let i=period;i<dx.length;i++){ adx=((adx*(period-1))+dx[i])/period; } return adx;
}
export function computeRSI(closes, period=14){
  if (closes.length<period+1) return null; let gains=0, losses=0;
  for(let i=closes.length-period;i<closes.length;i++){ const d=closes[i]-closes[i-1]; if(d>0) gains+=d; else losses-=d; }
  const rs=(gains/period)/((losses/period)||1e-9); return 100 - (100/(1+rs));
}
export function computeMACD(closes, f=12, s=26, sig=9){
  if (closes.length < s+sig) return null;
  const eFast = ema(closes, f), eSlow = ema(closes, s); if(eFast==null||eSlow==null) return null;
  const macd=eFast - eSlow; const k=2/(sig+1); let signal=macd; for(let i=0;i<sig;i++){ signal=macd*k + signal*(1-k); }
  const hist=macd - signal; return { macd, signal, hist, eFast, eSlow };
}
export function computeStochastic(bars, kPeriod=14, dPeriod=3){
  if (!bars||bars.length<kPeriod+1) return null; const slice=bars.slice(-kPeriod);
  const h=Math.max(...slice.map(b=>b.h)), l=Math.min(...slice.map(b=>b.l)), c=bars[bars.length-1].c;
  const k=h===l?50:((c-l)/(h-l))*100; const d=(2*k + k)/3; return { k, d };
}
export { sma };
