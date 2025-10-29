import { fetchBars, fetchPrice, exportCSV, notifyTelegram, logDecision } from '../lib/datafeed.js';
import { computeATR, computeBB, computeRSI, computeMACD, computeStochastic, ema } from '../core/indicators.js';
import { classifyRegime } from '../core/regime.js';
import { detectCandles } from '../core/candles.js';
import { tradeModeDefaults, fuseSignals } from '../core/fuse.js';
import { drawChart } from './chart.js';
import { runBacktest } from './backtest.js';
import { plotLine, plotMACD } from './panels.js';

const $=id=>document.getElementById(id), LS='gsx.m.';
// Header
const themeBtn=$('themeBtn');
const baseEl=$('base'), priceEl=$('price'); $('saveBase').onclick=()=>localStorage.setItem(LS+'base', baseEl.value.trim()); baseEl.value=localStorage.getItem(LS+'base')||'';
const btnPrice=$('btnPrice'); const tfBar=$('tfBar'); const btnCSV=$('btnCSV'); const btnBars=$('btnBars'); const chart=$('chart');
const regimeTop=$('regimeTop'), modeTop=$('modeTop');
const modeSmart=$('modeSmart'), modeFast=$('modeFast'), modeSafe=$('modeSafe');
const macdPanel=$('macdPanel'), rsiPanel=$('rsiPanel'), stochPanel=$('stochPanel'); const showMacd=$('showMacd'), showRsi=$('showRsi'), showStoch=$('showStoch'); const showBB=$('showBB'); const showPatterns=$('showPatterns');

// Indicators & advice
const adxVal=$('adxVal'), rsiVal=$('rsiVal'), macdVal=$('macdVal'), stochVal=$('stochVal'), emaFastVal=$('emaFast'), emaSlowVal=$('emaSlow'), bbWidthEl=$('bbWidth'), regimeBadge=$('regimeBadge');
const atrMode=$('atrMode'), atrPeriodEl=$('atrPeriod'), atrVal=$('atrVal');
const bbMode=$('bbMode'), bbPeriodEl=$('bbPeriod'), bbStdEl=$('bbStd'), bbMA=$('bbMA'), bbUp=$('bbUp'), bbLo=$('bbLo');
const emaMode=$('emaMode'), emaFastIn=$('emaFastIn'), emaSlowIn=$('emaSlowIn'), emaOn=$('emaOn');
const rsiMode=$('rsiMode'), rsiPeriod=$('rsiPeriod'), rsiOn=$('rsiOn'), rsiPLabel=$('rsiPLabel');
const macdMode=$('macdMode'), macdFast=$('macdFast'), macdSlow=$('macdSlow'), macdSig=$('macdSig'), macdOn=$('macdOn'), macdFLabel=$('macdFLabel'), macdSLabel=$('macdSLabel'), macdSigLabel=$('macdSigLabel');
const stochMode=$('stochMode'), stochK=$('stochK'), stochD=$('stochD'), stochOn=$('stochOn'), stochKLabel=$('stochKLabel'), stochDLabel=$('stochDLabel');

const adviceText=$('adviceText'), confVal=$('confVal'), reasonsList=$('reasonsList'), entryVal=$('entryVal'), tp1Val=$('tp1Val'), tp2Val=$('tp2Val'), slVal=$('slVal');
const dbgToggle=$('dbgToggle'), logEl=$('log');
const btnRecalc=$('btnRecalc'), btnNotify=$('btnNotify');
// restore panel prefs
try{ const sb=localStorage.getItem(LS+'bb'); if(sb!==null) showBB.checked = (sb==='1'); const ss=localStorage.getItem(LS+'stoch'); if(ss!==null) showStoch.checked=(ss==='1'); const sp=localStorage.getItem(LS+'pt'); if(sp!==null) showPatterns.checked=(sp==='1'); }catch{}
const btnBacktest=$('btnBacktest'), btTrades=$('btTrades'), btPL=$('btPL'), btWin=$('btWin'), btDD=$('btDD'), csvFile=$('csvFile');

// Modes defaults: keep 'smart' by default
let tradeMode='smart';
function tradeModeDefaultsMobile(){ return tradeModeDefaults(tradeMode); }

function setTradeMode(m){ tradeMode=m; localStorage.setItem(LS+'mode', m); if(modeTop) modeTop.textContent = m==='smart'?'ذكي': m==='fast'?'سريع':'حذر'; }
const savedMode = localStorage.getItem(LS+'mode'); if(savedMode){ setTradeMode(savedMode); if(savedMode==='smart'&&modeSmart) modeSmart.checked=true; if(savedMode==='fast'&&modeFast) modeFast.checked=true; if(savedMode==='safe'&&modeSafe) modeSafe.checked=true; }
if(modeSmart) modeSmart.onchange=()=>{ if(modeSmart.checked){ setTradeMode('smart'); if(lastBars.length) computeAndRender(lastBars);} };
if(modeFast)  modeFast .onchange=()=>{ if(modeFast.checked){  setTradeMode('fast');  if(lastBars.length) computeAndRender(lastBars);} };
if(modeSafe)  modeSafe .onchange=()=>{ if(modeSafe.checked){  setTradeMode('safe');  if(lastBars.length) computeAndRender(lastBars);} };


function bindMode(select, inputs){ function upd(){ const man = select.value==='manual'; inputs.forEach(i=>i.disabled=!man); } select.addEventListener('change',upd); upd(); }
bindMode(atrMode,[atrPeriodEl]); bindMode(bbMode,[bbPeriodEl,bbStdEl]); bindMode(emaMode,[emaFastIn,emaSlowIn]); bindMode(rsiMode,[rsiPeriod]); bindMode(macdMode,[macdFast,macdSlow,macdSig]); bindMode(stochMode,[stochK,stochD]);

tfBar.addEventListener('click',(e)=>{ if(e.target.tagName!=='BUTTON') return; document.querySelectorAll('#tfBar button').forEach(b=>b.classList.remove('primary')); e.target.classList.add('primary'); });
btnPrice.onclick=async()=>{ try{ const j=await fetchPrice(getBase()); priceEl.textContent=`${j.price} @ ${new Date(j.ts).toLocaleTimeString()}`; if(lastBars.length) drawChart(chart,lastBars,j.price,lastMarkers);}catch(e){log(e.message);} };
btnCSV.onclick=()=>{ try{ exportCSV(getBase(), getTF()); }catch(e){ log(e.message);} };

let lastBars=[], lastMarkers=null;

btnBars.onclick=async()=>{ try{ const tf=getTF(); const limit=Number($('limit').value||1200); lastBars=await fetchBars(getBase(), tf, limit); await computeAndRender(lastBars);}catch(e){log(e.message);} };
btnRecalc.onclick=async()=>{ if(lastBars.length) await computeAndRender(lastBars); };
btnNotify.onclick=async()=>{ if(!lastBars.length) return; const inf=await computeAndRender(lastBars,true); try{ const text=`🔔 GSX Mobile\n${inf.summary}\nTF: ${getTF()}`; await notifyTelegram(getBase(),{text}); await logDecision(getBase(),{...inf, tf:getTF()}); }catch(e){ log(e.message);} };

btnBacktest.onclick=async()=>{ if(!lastBars.length) return; const bt=runBacktest(lastBars, getModeParams()); btTrades.textContent=bt.trades; btPL.textContent=bt.pl; btWin.textContent=bt.win+'%'; btDD.textContent=bt.maxDD; };
csvFile.onchange=async()=>{ const f=csvFile.files[0]; if(!f) return; const text=await f.text(); const rows=text.trim().split(/\r?\n/).slice(1).map(l=>{ const [t,o,h,l,c,v]=l.split(','); return { t:Date.parse(t), o:+o, h:+h, l:+l, c:+c, v:+(v||0)}; }); lastBars=rows; await computeAndRender(lastBars); };

showMacd.onchange=()=>{ macdPanel.style.display=showMacd.checked?'block':'none'; if(lastBars.length) computeAndRender(lastBars); };
showRsi.onchange=()=>{ rsiPanel.style.display=showRsi.checked?'block':'none'; if(lastBars.length) computeAndRender(lastBars); };
showStoch.onchange=()=>{ localStorage.setItem(LS+'stoch', showStoch.checked?'1':'0'); stochPanel.style.display=showStoch.checked?'block':'none'; if(lastBars.length) computeAndRender(lastBars); };
showBB.onchange=()=>{ localStorage.setItem(LS+'bb', showBB.checked?'1':'0'); if(lastBars.length) computeAndRender(lastBars); };
showPatterns.onchange=()=>{ localStorage.setItem(LS+'pt', showPatterns.checked?'1':'0'); if(lastBars.length) computeAndRender(lastBars); };

dbgToggle.onchange=()=>{ logEl.style.display=dbgToggle.checked?'block':'none'; };

function getTF(){ const a=document.querySelector('#tfBar button.primary'); return a? a.dataset.tf : '1m'; }
function getBase(){ const v=baseEl.value.trim().replace(/\/+$/,''); if(!v) throw new Error('ضع رابط الووركر أولاً'); return v; }
function log(s){ if(!dbgToggle.checked) return; logEl.style.display='block'; logEl.textContent=`[${new Date().toLocaleTimeString()}] ${s}\n`+logEl.textContent; }


// ===== Mobile UX extras =====
const toast=document.getElementById('toast'), toastTitle=document.getElementById('toastTitle'), toastMsg=document.getElementById('toastMsg'), toastClose=document.getElementById('toastClose');
toastClose.onclick=()=> toast.classList.remove('show');
let lastAdviceKind=null, lastConf=0; let patternListCache=[];

function showToast(title, msg){
  if(!toast) return;
  toastTitle.textContent=title||'تنبيه';
  toastMsg.textContent=msg||'';
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'), 5000);
}

function vibrateShort(){ try{ if('vibrate' in navigator) navigator.vibrate([40,40,40]); }catch{} }
function flashScreen(){ const f=document.getElementById('flash'); if(!f) return; f.classList.add('on'); setTimeout(()=>f.classList.remove('on'), 250); }

async function ensureBrowserNotif(){
  try{
    if(!('Notification' in window)) return false;
    if(Notification.permission==='granted') return true;
    if(Notification.permission!=='denied'){ const p=await Notification.requestPermission(); return p==='granted'; }
  }catch{} return false;
}
function browserNotify(text){ try{ if('Notification' in window && Notification.permission==='granted') new Notification('GoldSignalsX', { body:text }); }catch{} }

function onAdviceChange(kind, confidence, summary){
  const majorFlip = (lastAdviceKind && kind && kind!==lastAdviceKind);
  const confUp = (confidence - (lastConf||0)) >= 0.2;
  if(majorFlip || confUp){
    vibrateShort(); flashScreen();
    showToast('تنبيه إشارة', summary);
    ensureBrowserNotif().then(ok=>{ if(ok) browserNotify(summary); });
  }
  lastAdviceKind = kind; lastConf = confidence;
}
// ===== /Mobile UX extras =====



// ==== Candlestick basic pattern detection ====
function bodySize(b){ return Math.abs(b.c - b.o); }
function candleRange(b){ return b.h - b.l; }
function isDoji(b){ return bodySize(b) <= Math.max(0.0001, candleRange(b)*0.1); }
function isHammer(b){ const upper = b.h - Math.max(b.o,b.c); const lower = Math.min(b.o,b.c) - b.l; return lower >= bodySize(b)*2 && upper <= bodySize(b)*0.5; }
function isShootingStar(b){ const upper = b.h - Math.max(b.o,b.c); const lower = Math.min(b.o,b.c) - b.l; return upper >= bodySize(b)*2 && lower <= bodySize(b)*0.5; }
function isBullishEngulf(prev,curr){ return (curr.c>curr.o && prev.c<prev.o && curr.c>=prev.o && curr.o<=prev.c); }
function isBearishEngulf(prev,curr){ return (curr.c<curr.o && prev.c>prev.o && curr.o>=prev.c && curr.c<=prev.o); }
function detectBasicPatterns(arr){
  const out=[];
  for(let i=1;i<arr.length;i++){
    const b=arr[i], p=arr[i-1];
    if(isBullishEngulf(p,b)) out.push({i, name:'Bullish Engulfing', kind:'bull'});
    else if(isBearishEngulf(p,b)) out.push({i, name:'Bearish Engulfing', kind:'bear'});
    else if(isHammer(b)) out.push({i, name:'Hammer', kind:'bull'});
    else if(isShootingStar(b)) out.push({i, name:'Shooting Star', kind:'bear'});
    else if(isDoji(b)) out.push({i, name:'Doji', kind:'neutral'});
  }
  return out;
}
// ==== /Candlestick basic pattern detection ====

function autoPanelsByRegime(regime){
  // Only apply if user didn't explicitly set
  const userBB = localStorage.getItem(LS+'bb');
  const userSt = localStorage.getItem(LS+'stoch');
  // Smart defaults
  if(userBB===null){
    // In RANGE or Safe mode -> BB on; in strong TREND + Fast mode -> BB off for clarity
    const mode = tradeMode;
    const on = (regime==='RANGE') || (mode==='safe') || (regime==='NEUTRAL');
    showBB.checked = on;
  }
  if(userSt===null){
    // In TREND we prefer Stoch visible for timing pullbacks; in RANGE also helpful
    showStoch.checked = (regime!=='NEUTRAL');
    stochPanel.style.display = showStoch.checked? 'block':'none';
  }
}

function getModeParams(){
  const d = tradeModeDefaultsMobile();
  return {
    atrMult: d.atrMult,
    bbStd: (bbMode.value==='manual'? Number(bbStdEl.value||d.bbStd) : d.bbStd),
    emaFast: (emaMode.value==='manual'? Number(emaFastIn.value||d.emaFast) : d.emaFast),
    emaSlow: (emaMode.value==='manual'? Number(emaSlowIn.value||d.emaSlow) : d.emaSlow),
    emaOn: emaOn.checked,
    rsiP: (rsiMode.value==='manual'? Number(rsiPeriod.value||d.rsiP) : d.rsiP),
    rsiOn: rsiOn.checked,
    macdF: (macdMode.value==='manual'? Number(macdFast.value||d.macdF) : d.macdF),
    macdS: (macdMode.value==='manual'? Number(macdSlow.value||d.macdS) : d.macdS),
    macdSig: (macdMode.value==='manual'? Number(macdSig.value||d.macdSig) : d.macdSig),
    macdOn: macdOn.checked,
    stochK: (stochMode.value==='manual'? Number(stochK.value||d.stochK) : d.stochK),
    stochD: (stochMode.value==='manual'? Number(stochD.value||d.stochD) : d.stochD),
    stochOn: stochOn.checked
  };
}


// ==== Pivot Levels (auto table) ====
function computePivotLevels(bar){
  if(!bar) return null;
  const H = bar.h ?? bar.high, L = bar.l ?? bar.low, C = bar.c ?? bar.close;
  if([H,L,C].some(v=>v==null)) return null;
  const P=(H+L+C)/3;
  const R1=2*P-L, S1=2*P-H;
  const R2=P+(H-L), S2=P-(H-L);
  const R3=H+2*(P-L), S3=L-2*(H-P);
  return {P,R1,R2,R3,S1,S2,S3};
}
function updatePivotTable(lastBar, livePrice){
  const tbody = document.querySelector('#pivotTable tbody'); const priceInfo = document.getElementById('pivotPrice');
  if(!tbody){ return; }
  const piv = computePivotLevels(lastBar); if(!piv){ tbody.innerHTML = ''; if(priceInfo) priceInfo.textContent=''; return; }
  const levels=[
    ['R3', piv.R3, 'مقاومة قويّة 🔺', 'res'],
    ['R2', piv.R2, 'مقاومة متوسطة 🔺', 'res'],
    ['R1', piv.R1, 'مقاومة قريبة 🔺', 'res'],
    ['P',  piv.P,  'Pivot ⚖️',        'pivot'],
    ['S1', piv.S1, 'دعم قريب 🔻',     'sup'],
    ['S2', piv.S2, 'دعم متوسطة 🔻',   'sup'],
    ['S3', piv.S3, 'دعم قويّة 🔻',    'sup'],
  ];
  tbody.innerHTML = '';
  for(const [name,val,label,cls] of levels){
    const diff = (livePrice!=null)? (livePrice - val) : null;
    const diffTxt = (diff==null? '—' : (diff>=0? '+' : '') + diff.toFixed(2));
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="${cls}">${name}</td><td>${val.toFixed(2)}</td><td>${diffTxt}</td><td>${label}</td>`;
    tbody.appendChild(tr);
  }
  if(priceInfo){ priceInfo.textContent = 'السعر الحالي: ' + (livePrice!=null? livePrice.toFixed(2) : '—'); }
}
// ==== /Pivot Levels ====

async function computeAndRender(bars, retOnly=false){
  const closes = bars.map(b=>b.c);
  const rinfo = classifyRegime(bars, closes); regimeBadge.textContent=rinfo.regime; adxVal.textContent=(rinfo.adx??0).toFixed(2); if(regimeTop) regimeTop.textContent=rinfo.regime;

  const cfg = getModeParams();
  $('rsiPLabel').textContent = cfg.rsiP;
  $('macdFLabel').textContent = cfg.macdF; $('macdSLabel').textContent = cfg.macdS; $('macdSigLabel').textContent = cfg.macdSig;
  $('stochKLabel').textContent = cfg.stochK; $('stochDLabel').textContent = cfg.stochD;

  const atrP = (atrMode.value==='manual')? Number(atrPeriodEl.value||14) : (getTF()==='1d'?20:14);
  const atr = computeATR(bars, atrP); atrVal.textContent = atr? atr.toFixed(3) : '—';

  const bb = computeBB(closes, (bbMode.value==='manual'? Number(bbPeriodEl.value||20) : 20), cfg.bbStd);
  if (bb){ bbMA.textContent=bb.ma.toFixed(3); bbUp.textContent=bb.upper.toFixed(3); bbLo.textContent=bb.lower.toFixed(3); bbWidthEl.textContent=(bb.width*100).toFixed(2)+'%'; }

  const eFast = ema(closes, cfg.emaFast); const eSlow = ema(closes, cfg.emaSlow);
  emaFastVal.textContent = eFast? eFast.toFixed(2):'—'; emaSlowVal.textContent = eSlow? eSlow.toFixed(2):'—';

  const candlesSig = detectCandles(bars);
  const fused = fuseSignals({ candlesSig, regime:rinfo.regime, closes, bars, cfg });
  renderAdvice(fused, atr, bars);

  const rsi = cfg.rsiOn? (fused.rsi ?? null) : null;
  if (rsi!=null) rsiVal.textContent=rsi.toFixed(2); else rsiVal.textContent='—';
  if (fused.macd){ macdVal.textContent = `${fused.macd.macd.toFixed(3)} / s:${fused.macd.signal.toFixed(3)}`; } else macdVal.textContent='—';
  if (fused.stoch){ stochVal.textContent = `${fused.stoch.k.toFixed(1)} / ${fused.stoch.d.toFixed(1)}`; } else stochVal.textContent='—';

  const live = (priceEl.textContent.includes('@')? Number(priceEl.textContent.split(' @ ')[0]) : bars[bars.length-1].c);
  drawChart(chart, bars, live, lastMarkers, {
    patterns:{ on: (showPatterns && showPatterns.checked), list:(patternListCache||[]) },
    bb:{ on: showBB && showBB.checked },
    ema:{ on: (emaOn && (true)), fast: cfg.emaFast, slow: cfg.emaSlow },
    legend:{ regime: rinfo.regime, mode: (tradeMode==='smart'?'ذكي':tradeMode==='fast'?'سريع':'حذر'), flags:{ bb: showBB && showBB.checked, ema: emaOn, stoch: showStoch && showStoch.checked, rsi: showRsi && showRsi.checked } }
  });

  // Panels
  try{
    if (showMacd.checked && fused.macd){ const m=[], s=[], h=[]; for (let i=0;i<closes.length;i++){ const w=computeMACD(closes.slice(0,i+1), cfg.macdF, cfg.macdS, cfg.macdSig); if(w){ m.push(w.macd); s.push(w.signal); h.push(w.hist);} } plotMACD(macdPanel, m, s, h); macdPanel.style.display='block'; } else macdPanel.style.display='none';
    if (showRsi.checked){ const rs=[]; for(let i=0;i<closes.length;i++){ const r=computeRSI(closes.slice(0,i+1), cfg.rsiP); if(r!=null) rs.push(r);} plotLine(rsiPanel, rs, {min:0,max:100,hlines:[{y:30},{y:50},{y:70}], bands:[{from:70,to:100,fill:'rgba(239,68,68,0.10)'},{from:0,to:30,fill:'rgba(16,185,129,0.10)'}]}); rsiPanel.style.display='block'; } else rsiPanel.style.display='none';
    if (showStoch.checked){ const ks=[]; for(let i=0;i<bars.length;i++){ const s=computeStochastic(bars.slice(0,i+1), cfg.stochK, cfg.stochD); if(s) ks.push(s.k); } plotLine(stochPanel, ks, {min:0,max:100,hlines:[{y:20},{y:50},{y:80}], bands:[{from:80,to:100,fill:'rgba(239,68,68,0.08)'},{from:0,to:20,fill:'rgba(16,185,129,0.08)'}]}); stochPanel.style.display='block'; } else stochPanel.style.display='none';
  }catch(e){ log(e.message); }

  const summary = `${fused.advice} | ثقة ${fused.confidence} | دخول ${entryVal.textContent} | TP1 ${tp1Val.textContent} | TP2 ${tp2Val.textContent} | SL ${slVal.textContent}`;
  onAdviceChange(fused.advice==='شراء'?+1:fused.advice==='بيع'?-1:0, fused.confidence, summary);
  const out = { regime:rinfo.regime, atr, bb, advice:fused.advice, confidence:fused.confidence, summary, cfg };
  if (retOnly) return out; return out;
}
function renderAdvice(fused, atr, bars){
  adviceText.textContent=fused.advice; confVal.textContent=fused.confidence; reasonsList.innerHTML='';
  fused.reasons.forEach(r=>{ const li=document.createElement('li'); li.textContent=r; reasonsList.appendChild(li); });
  const last=bars[bars.length-1]; const entry=last.c; const K=(atr||0)*(getModeParams().atrMult)|| (last.h-last.l)*0.8;
  let sl,tp1,tp2; if (fused.advice==='شراء'){ sl=entry-K; tp1=entry+K*1.2; tp2=entry+K*2; } else if (fused.advice==='بيع'){ sl=entry+K; tp1=entry-K*1.2; tp2=entry-K*2; }
  entryVal.textContent=entry.toFixed(2); slVal.textContent=sl?sl.toFixed(2):'—'; tp1Val.textContent=tp1?tp1.toFixed(2):'—'; tp2Val.textContent=tp2?tp2.toFixed(2):'—';
  lastMarkers={ entry, sl, tp1, tp2 };
}
