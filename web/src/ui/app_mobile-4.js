// app_mobile.js — GoldSignalsX • Advanced v4
// يربط واجهة index مع ال Worker:
//  - /price  → سعر حي
//  - /bars   → شموع + مؤشرات + نصيحة + Pivot + Backtest
// ملاحظة: لا يحتاج أي ملفات أخرى (كل الحسابات داخله)

// ================== عناصر الـ DOM ==================
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// حقول أساسية
const baseIn   = $('#base');
const saveBase = $('#saveBase');
const btnPrice = $('#btnPrice');
const tfBar    = $('#tfBar');
const limitIn  = $('#limit');
const btnBars  = $('#btnBars');
const btnCSV   = $('#btnCSV');

// السعر الحي
const priceEl  = $('#price');
const liveDtEl = $('#liveDateTime');
const livePriceHidden  = $('#livePrice');
const liveSourceHidden = $('#liveSource');
const liveTimeHidden   = $('#liveTime');

// المؤشرات (تبويب المؤشرات)
const adxValEl    = $('#adxVal');
const rsiValEl    = $('#rsiVal');
const macdValEl   = $('#macdVal');
const stochValEl  = $('#stochVal');
const emaFastEl   = $('#emaFast');
const emaSlowEl   = $('#emaSlow');
const bbWidthEl   = $('#bbWidth');
const regimeBadge = $('#regimeBadge');

const atrModeEl   = $('#atrMode');
const atrPeriodEl = $('#atrPeriod');
const atrValEl    = $('#atrVal');

const bbModeEl    = $('#bbMode');
const bbPeriodEl  = $('#bbPeriod');
const bbStdEl     = $('#bbStd');
const bbMAEl      = $('#bbMA');
const bbUpEl      = $('#bbUp');
const bbLoEl      = $('#bbLo');

const emaModeEl   = $('#emaMode');
const emaFastInEl = $('#emaFastIn');
const emaSlowInEl = $('#emaSlowIn');
const emaOnEl     = $('#emaOn');

const rsiModeEl   = $('#rsiMode');
const rsiPeriodEl = $('#rsiPeriod');
const rsiOnEl     = $('#rsiOn');

const macdModeEl  = $('#macdMode');
const macdFastEl  = $('#macdFast');
const macdSlowEl  = $('#macdSlow');
const macdSigEl   = $('#macdSig');
const macdOnEl    = $('#macdOn');

const stochModeEl = $('#stochMode');
const stochKEl    = $('#stochK');
const stochDEl    = $('#stochD');
const stochOnEl   = $('#stochOn');

// وضع السوق
const regimeTopEl = $('#regimeTop');
const modeTopEl   = $('#modeTop');
const marketStateEl = $('#marketState');

// تبويب النصيحة
const adviceTextEl = $('#adviceText');
const confValEl    = $('#confVal');
const entryValEl   = $('#entryVal');
const tp1ValEl     = $('#tp1Val');
const tp2ValEl     = $('#tp2Val');
const slValEl      = $('#slVal');
const reasonsListEl= $('#reasonsList');
const btnNotify    = $('#btnNotify');
const btnRecalc    = $('#btnRecalc');

// Debug
const dbgToggleEl = $('#dbgToggle');
const logEl       = $('#log');

// Backtest
const btnBacktest = $('#btnBacktest');
const csvFileEl   = $('#csvFile');
const btTradesEl  = $('#btTrades');
const btPLEl      = $('#btPL');
const btWinEl     = $('#btWin');
const btDDEl      = $('#btDD');

// Pivot
const pivotTableBody = $('#pivotTable tbody');
const pivotPriceEl   = $('#pivotPrice');

// Toast + Flash
const flashEl      = $('#flash');
const toastEl      = $('#toast');
const toastTitleEl = $('#toastTitle');
const toastMsgEl   = $('#toastMsg');
const toastCloseEl = $('#toastClose');

// Mode radio buttons
const modeSmartEl = $('#modeSmart');
const modeFastEl  = $('#modeFast');
const modeSafeEl  = $('#modeSafe');

// ================== حالة عامة ==================
const DEFAULT_BASE = 'https://goldsignalsx-worker.samer-mourtada.workers.dev';

let lastBars = [];
let lastLive = null;   // {price, ts, source}
let chart, candleSeries;
let rsiChart, rsiSeries;
let macdChart, macdSeries;
let stochChart, stochSeries;

let lastSignalSide = 'none'; // 'buy' | 'sell' | 'none'

// ================== Utilities ==================
function getBase() {
  const v = (baseIn && baseIn.value || '').trim();
  if (v) return v.replace(/\/+$/,'');
  const saved = localStorage.getItem('GSX_BASE_URL') || '';
  return (saved || DEFAULT_BASE).replace(/\/+$/,'');
}
function setBase(v) {
  const x = (v || '').replace(/\/+$/,'');
  try { localStorage.setItem('GSX_BASE_URL', x); } catch {}
  if (baseIn) baseIn.value = x;
}

function fmtDateTime(ts) {
  try {
    const d = new Date(ts || Date.now());
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    const ss = String(d.getSeconds()).padStart(2,'0');
    return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
  } catch(e) {
    return '—';
  }
}

function logDebug(msg) {
  console.log('[GSX]', msg);
  if (!logEl) return;
  const t = `[${new Date().toLocaleTimeString()}] ${msg}\n`;
  logEl.textContent = t + logEl.textContent;
}

// ================== حساب المؤشرات ==================
function ema(arr, p) {
  if (!arr || arr.length === 0) return [];
  const k = 2 / (p + 1);
  let e = arr[0];
  const out = [e];
  for (let i = 1; i < arr.length; i++) {
    e = (arr[i] - e) * k + e;
    out.push(e);
  }
  return out;
}

function sma(arr, p) {
  const out = [];
  const q = [];
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    q.push(arr[i]);
    sum += arr[i];
    if (q.length > p) sum -= q.shift();
    out.push(q.length === p ? sum / p : null);
  }
  return out;
}

function std(arr, p, ma) {
  const out = [];
  const q = [];
  for (let i = 0; i < arr.length; i++) {
    q.push(arr[i]);
    if (q.length > p) q.shift();
    if (q.length === p) {
      const m = ma[i];
      let s = 0;
      for (const v of q) s += (v - m) * (v - m);
      out.push(Math.sqrt(s / p));
    } else {
      out.push(null);
    }
  }
  return out;
}

function calcBB(closes, period = 20, mult = 2) {
  const ma = sma(closes, period);
  const s  = std(closes, period, ma);
  const upper = [];
  const lower = [];
  for (let i = 0; i < closes.length; i++) {
    if (ma[i] == null || s[i] == null) {
      upper.push(null);
      lower.push(null);
    } else {
      upper.push(ma[i] + mult * s[i]);
      lower.push(ma[i] - mult * s[i]);
    }
  }
  return { ma, upper, lower };
}

function calcATR(bars, period = 14) {
  if (!bars || bars.length < 2) return [];
  const trs = [];
  for (let i = 0; i < bars.length; i++) {
    if (i === 0) {
      trs.push(bars[i].h - bars[i].l);
    } else {
      const cPrev = bars[i - 1].c;
      const x1 = bars[i].h - bars[i].l;
      const x2 = Math.abs(bars[i].h - cPrev);
      const x3 = Math.abs(bars[i].l - cPrev);
      trs.push(Math.max(x1, x2, x3));
    }
  }
  const out = [];
  let atr = trs.slice(0, period).reduce((a,b)=>a+b,0)/period;
  for (let i = 0; i < bars.length; i++) {
    if (i < period) {
      out.push(null);
    } else if (i === period) {
      out.push(atr);
    } else {
      atr = (atr * (period - 1) + trs[i]) / period;
      out.push(atr);
    }
  }
  return out;
}

function calcRSI(closes, period = 14) {
  if (closes.length <= period) return [];
  const gains = [];
  const losses = [];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(Math.max(diff, 0));
    losses.push(Math.max(-diff, 0));
  }
  let avgGain =
    gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss =
    losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const out = Array(period).fill(null);
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    out.push(rs);
  }
  return out;
}

function calcStoch(closes, highs, lows, period = 14) {
  if (closes.length < period) return [];
  const out = [];
  for (let i = period - 1; i < closes.length; i++) {
    let h = -Infinity;
    let l = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (highs[j] > h) h = highs[j];
      if (lows[j] < l) l = lows[j];
    }
    const k = ((closes[i] - l) / (h - l || 1)) * 100;
    out.push(k);
  }
  while (out.length < closes.length) out.unshift(null);
  return out;
}

function calcMACD(closes, fast = 12, slow = 26, signal = 9) {
  const fastE = ema(closes, fast);
  const slowE = ema(closes, slow);
  const len = Math.min(fastE.length, slowE.length);
  const macdLine = [];
  for (let i = 0; i < len; i++) macdLine.push(fastE[i] - slowE[i]);
  const signalLine = ema(macdLine, signal);
  const hist = macdLine.map((v, i) => v - (signalLine[i] ?? 0));
  return { macdLine, signalLine, hist };
}

function calcADX(bars, period = 14) {
  const len = bars.length;
  if (len < period + 2) {
    return { plusDI: [], minusDI: [], ADX: [] };
  }
  const plusDM = Array(len).fill(0);
  const minusDM = Array(len).fill(0);
  const TR = Array(len).fill(0);
  for (let i = 1; i < len; i++) {
    const upMove = bars[i].h - bars[i-1].h;
    const downMove = bars[i-1].l - bars[i].l;
    plusDM[i]  = (upMove > downMove && upMove > 0) ? upMove : 0;
    minusDM[i] = (downMove > upMove && downMove > 0) ? downMove : 0;
    const x1 = bars[i].h - bars[i].l;
    const x2 = Math.abs(bars[i].h - bars[i-1].c);
    const x3 = Math.abs(bars[i].l - bars[i-1].c);
    TR[i] = Math.max(x1,x2,x3);
  }
  function wSmooth(src) {
    const out = Array(len).fill(null);
    let s = 0;
    for (let i = 1; i <= period; i++) s += src[i] || 0;
    out[period] = s;
    for (let i = period+1; i < len; i++){
      out[i] = out[i-1] - (out[i-1]/period) + (src[i]||0);
    }
    return out;
  }
  const trN = wSmooth(TR);
  const pN  = wSmooth(plusDM);
  const mN  = wSmooth(minusDM);

  const plusDI  = Array(len).fill(null);
  const minusDI = Array(len).fill(null);
  const DX      = Array(len).fill(null);

  for (let i = period; i < len; i++) {
    if (!trN[i]) continue;
    plusDI[i]  = 100 * (pN[i]/trN[i]);
    minusDI[i] = 100 * (mN[i]/trN[i]);
    const s = plusDI[i] + minusDI[i];
    DX[i] = s ? (100 * Math.abs(plusDI[i]-minusDI[i]) / s) : 0;
  }

  const ADX = Array(len).fill(null);
  let seed = 0, count=0, start=-1;
  for(let i=0;i<len;i++){
    if (DX[i]!=null){
      seed += DX[i]; count++;
      if (count===period){
        ADX[i] = seed/period;
        start=i; break;
      }
    }
  }
  for (let i=start+1;i<len;i++){
    if (DX[i]!=null) ADX[i] = ((ADX[i-1]*(period-1))+DX[i])/period;
  }
  return { plusDI, minusDI, ADX };
}

function detectPattern(bars) {
  if (!bars || bars.length < 2) return { name: 'لا يوجد', detail: '' };
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];

  const body = Math.abs(last.c - last.o);
  const range = last.h - last.l || 1;
  const upper = last.h - Math.max(last.o, last.c);
  const lower = Math.min(last.o, last.c) - last.l;

  const isBull = last.c > last.o;
  const isBear = last.o > last.c;

  if (body / range < 0.3 && lower / range > 0.5 && upper / range < 0.1) {
    return { name: 'Hammer', detail: 'شمعة مطرقة؛ احتمال انعكاس صعودي.' };
  }
  if (body / range < 0.3 && upper / range > 0.5 && lower / range < 0.1) {
    return { name: 'Shooting Star', detail: 'نجم ساقط؛ احتمال انعكاس هبوطي.' };
  }
  if (prev.o > prev.c && isBull && last.c > prev.o && last.o < prev.c) {
    return { name: 'Bullish Engulfing', detail: 'ابتلاع شرائي؛ يقوّي احتمال الصعود.' };
  }
  if (prev.c > prev.o && isBear && last.o > prev.c && last.c < prev.o) {
    return { name: 'Bearish Engulfing', detail: 'ابتلاع بيعي؛ يقوّي احتمال الهبوط.' };
  }
  return { name: 'لا يوجد نمط واضح', detail: '' };
}

// ================== Market / Regime ==================
function analyzeMarket(bars, closes, opts={}){
  const bbP  = +(bbPeriodEl?.value || 20);
  const bbK  = +(bbStdEl?.value || 2);
  const atrP = +(atrPeriodEl?.value || 14);
  const adxP = 14;

  const { ma, upper, lower } = calcBB(closes, bbP, bbK);
  const atrArr = calcATR(bars, atrP);
  const { ADX, plusDI, minusDI } = calcADX(bars, adxP);

  const i = closes.length - 1;
  const C = closes[i];
  const U = upper[i];
  const L = lower[i];
  const M = ma[i];
  const ATR = atrArr[i];
  const adx = ADX[i];
  const pdi = plusDI[i];
  const mdi = minusDI[i];

  if (bbWidthEl && U!=null && L!=null && C){
    const widthPct = ((U - L) / C) * 100;
    bbWidthEl.textContent = widthPct.toFixed(2) + '%';
  }

  if (atrValEl && Number.isFinite(ATR)) atrValEl.textContent = ATR.toFixed(2);
  if (adxValEl && Number.isFinite(adx)) adxValEl.textContent = adx.toFixed(1);

  const bandwidthPct = (U!=null && L!=null && C) ? ((U-L)/C)*100 : NaN;
  const atrPct = (Number.isFinite(ATR) && C>0) ? (ATR/C)*100 : NaN;
  const Mprev = ma[i-1];
  const slopePct = (Mprev!=null && M!=null && Mprev!==0)
    ? ((M - Mprev)/Mprev)*100
    : 0;

  const pos = (C!=null && U!=null && L!=null) ? (C - L) / Math.max(1e-9, (U - L)) : NaN;
  const BW_TIGHT = 1.2, BW_WIDE=1.8, SLOPE_OK=0.03, ATR_OK=0.8, ATR_LOW=0.5, ADX_TREND=22;

  let state = 'حيادي';
  const trendBias = (pdi!=null && mdi!=null) ? (pdi>mdi ? 'صاعد' : 'هابط') : (slopePct>0?'صاعد':'هابط');

  if (bandwidthPct < BW_TIGHT && (isFinite(atrPct)? atrPct<ATR_LOW : true) && (adx==null || adx<ADX_TREND)) {
    state = 'رانج';
  } else if (bandwidthPct > BW_WIDE && Math.abs(slopePct) > SLOPE_OK && (isFinite(atrPct)? atrPct>ATR_OK : true) && (adx==null || adx>=ADX_TREND)) {
    state = `ترند ${trendBias}`;
  } else {
    if (adx!=null && adx>=ADX_TREND) state = `ترند ${trendBias}`;
    else state = 'رانج';
  }

  if (regimeBadge) regimeBadge.textContent = state;
  if (regimeTopEl) regimeTopEl.textContent = state;
  if (marketStateEl){
    const parts = [`الحالة: ${state}`];
    if (isFinite(bandwidthPct)) parts.push(`BB%: ${bandwidthPct.toFixed(2)}`);
    if (isFinite(atrPct))      parts.push(`ATR%: ${atrPct.toFixed(2)}`);
    if (isFinite(adx))         parts.push(`ADX: ${adx.toFixed(1)}`);
    marketStateEl.textContent = parts.join(' • ');
    marketStateEl.style.color = state.includes('ترند') ? 'var(--ok)' : 'var(--muted)';
  }

  if (rsiValEl){
    const rsiArr = calcRSI(closes, +(rsiPeriodEl?.value || 14));
    const lastRsi = rsiArr[rsiArr.length-1];
    if (Number.isFinite(lastRsi)) {
      let extra = '';
      if (lastRsi>70) extra = ' (تشبع شراء)';
      else if (lastRsi<30) extra=' (تشبع بيع)';
      rsiValEl.textContent = lastRsi.toFixed(1) + extra;
    } else rsiValEl.textContent = '—';
  }

  if (emaFastEl && emaSlowEl){
    const eFast = ema(closes, +(emaFastInEl?.value || 10));
    const eSlow = ema(closes, +(emaSlowInEl?.value || 34));
    const ef = eFast[eFast.length-1];
    const es = eSlow[eSlow.length-1];
    emaFastEl.textContent = Number.isFinite(ef) ? ef.toFixed(2) : '—';
    emaSlowEl.textContent = Number.isFinite(es) ? es.toFixed(2) : '—';
  }

  if (macdValEl){
    const m = calcMACD(closes,
      +(macdFastEl?.value || 12),
      +(macdSlowEl?.value || 26),
      +(macdSigEl?.value || 9)
    );
    const lastMacd = m.macdLine[m.macdLine.length-1];
    const lastSig  = m.signalLine[m.signalLine.length-1];
    if (Number.isFinite(lastMacd) && Number.isFinite(lastSig)) {
      macdValEl.textContent = `MACD: ${lastMacd.toFixed(3)}, Sig: ${lastSig.toFixed(3)}`;
    } else macdValEl.textContent = '—';
  }

  if (stochValEl){
    const st = calcStoch(closes, bars.map(b=>b.h), bars.map(b=>b.l), +(stochKEl?.value||14));
    const lastSt = st[st.length-1];
    if (Number.isFinite(lastSt)) {
      let extra = '';
      if (lastSt>80) extra=' (تشبع شراء)';
      else if (lastSt<20) extra=' (تشبع بيع)';
      stochValEl.textContent = lastSt.toFixed(1)+extra;
    } else stochValEl.textContent = '—';
  }

  return { state, ATR, bbUpper:upper, bbLower:lower };
}

// ================== Advice / Signal ==================
function chooseMode(){
  if (modeSafeEl?.checked)  return 'safe';
  if (modeFastEl?.checked)  return 'fast';
  return 'smart';
}

function computeAdvice(bars){
  if (!bars || bars.length < 20) {
    return { side:'none', text:'بيانات غير كافية', conf:0, entry:null,tp1:null,tp2:null,sl:null, reasons:[] };
  }

  const closes = bars.map(b=>b.c);
  const highs  = bars.map(b=>b.h);
  const lows   = bars.map(b=>b.l);

  const emaFlen = +(emaFastInEl?.value || 10);
  const emaSlen = +(emaSlowInEl?.value || 34);
  const rsiLen  = +(rsiPeriodEl?.value || 14);
  const stLen   = +(stochKEl?.value || 14);

  const eFast = ema(closes, emaFlen);
  const eSlow = ema(closes, emaSlen);
  const rsiArr= calcRSI(closes, rsiLen);
  const stArr = calcStoch(closes, highs, lows, stLen);
  const bbP   = +(bbPeriodEl?.value || 20);
  const bbK   = +(bbStdEl?.value || 2);
  const { ma, upper, lower } = calcBB(closes, bbP, bbK);
  const atrArr = calcATR(bars, +(atrPeriodEl?.value || 14));
  const { ADX } = calcADX(bars, 14);

  const i = closes.length - 1;
  const C = closes[i];
  const ef = eFast[eFast.length-1];
  const es = eSlow[eSlow.length-1];
  const rsi = rsiArr[rsiArr.length-1];
  const st  = stArr[stArr.length-1];
  const U = upper[upper.length-1];
  const L = lower[lower.length-1];
  const atr = atrArr[atrArr.length-1];
  const adx = ADX[ADX.length-1];
  const pat = detectPattern(bars);

  const mode = chooseMode();
  if (modeTopEl) {
    modeTopEl.textContent = mode === 'safe' ? 'حذر' : mode === 'fast' ? 'سريع' : 'ذكي';
  }

  let side = 'none';
  let reasons = [];
  let score = 0;

  const trendUp   = (ef>es) && (C>ef);
  const trendDown = (ef<es) && (C<ef);
  if (trendUp){ score+=2; reasons.push('EMA سريعة فوق EMA بطيئة → اتجاه صاعد');}
  if (trendDown){ score+=2; reasons.push('EMA سريعة تحت EMA بطيئة → اتجاه هابط');}

  if (Number.isFinite(rsi)){
    if (rsi<30){ score+=2; reasons.push('RSI < 30 → تشبع بيع، احتمال ارتداد صعودي');}
    else if (rsi>70){ score+=2; reasons.push('RSI > 70 → تشبع شراء، احتمال تصحيح هبوطي');}
  }
  if (Number.isFinite(st)){
    if (st<20) reasons.push('Stoch في تشبع بيع');
    else if (st>80) reasons.push('Stoch في تشبع شراء');
  }

  if (pat.name.includes('Bullish')){
    score+=2; reasons.push(`نمط شرائي: ${pat.name}`);
  } else if (pat.name.includes('Bearish')){
    score+=2; reasons.push(`نمط بيعي: ${pat.name}`);
  }

  if (Number.isFinite(adx)){
    if (adx>25){
      score+=1; reasons.push('ADX > 25 → ترند واضح');
    } else {
      reasons.push('ADX ضعيف → حركة جانبية');
    }
  }

  const bwPct = (U!=null && L!=null && C) ? ((U-L)/C)*100 : NaN;
  if (Number.isFinite(bwPct)){
    if (bwPct < 1.2) reasons.push('باند بولنغر ضيقة → سوق هادئ/رانج');
    else if (bwPct > 2) reasons.push('باند بولنغر واسعة → تقلب عالي');
  }

  if (!Number.isFinite(atr) || atr<=0) {
    reasons.push('ATR غير متوفر → صعوبة تقدير SL/TP بدقة');
  }

  if (trendUp && (rsi==null || rsi<70) && !pat.name.includes('Bearish')) side = 'buy';
  else if (trendDown && (rsi==null || rsi>30) && !pat.name.includes('Bullish')) side = 'sell';
  else side = 'none';

  if (mode === 'safe'){
    if (score<4) side = 'none';
  } else if (mode === 'fast'){
    if (score>=2 && side==='none') {
      side = trendUp ? 'buy' : trendDown ? 'sell' : 'none';
    }
  }

  let entry=null,tp1=null,tp2=null,sl=null;
  if (side!=='none' && atr){
    const multTP1 = mode==='fast' ? 1.0 : 1.5;
    const multTP2 = mode==='fast' ? 1.8 : 2.3;
    const multSL  = mode==='safe' ? 1.2 : 1.0;
    if (side==='buy'){
      entry = C;
      tp1   = C + multTP1*atr;
      tp2   = C + multTP2*atr;
      sl    = C - multSL*atr;
    } else {
      entry = C;
      tp1   = C - multTP1*atr;
      tp2   = C - multTP2*atr;
      sl    = C + multSL*atr;
    }
  }

  let conf = Math.max(0, Math.min(100, score*10));
  return { side, text: side==='buy' ? 'إشارة شراء' : side==='sell' ? 'إشارة بيع' : 'مراقبة فقط', conf, entry, tp1,tp2,sl, reasons, pattern:pat.name };
}

function applyAdvice(ad) {
  if (!adviceTextEl) return;
  adviceTextEl.textContent = ad.text;
  if (confValEl)  confValEl.textContent  = ad.conf ? ad.conf.toFixed(0)+'%' : '—';
  if (entryValEl) entryValEl.textContent = ad.entry ? ad.entry.toFixed(2) : '—';
  if (tp1ValEl)   tp1ValEl.textContent   = ad.tp1 ? ad.tp1.toFixed(2)     : '—';
  if (tp2ValEl)   tp2ValEl.textContent   = ad.tp2 ? ad.tp2.toFixed(2)     : '—';
  if (slValEl)    slValEl.textContent    = ad.sl  ? ad.sl.toFixed(2)      : '—';

  if (reasonsListEl) {
    reasonsListEl.innerHTML = '';
    (ad.reasons || []).forEach(r => {
      const li = document.createElement('li');
      li.textContent = r;
      reasonsListEl.appendChild(li);
    });
  }
}

// ================== Pivot ==================
function updatePivot(bars, livePrice){
  if (!pivotTableBody || !bars || !bars.length) return;
  const last = bars[bars.length-1];
  const H = last.h;
  const L = last.l;
  const C = last.c;
  const P = (H+L+C)/3;
  const R1 = 2*P - L;
  const S1 = 2*P - H;
  const R2 = P + (H-L);
  const S2 = P - (H-L);

  const price = livePrice || C;

  const rows = [
    { label:'Pivot', value:P, cls:'pivot', hint:'المركز المحوري لليوم' },
    { label:'R1', value:R1, cls:'res',    hint:'مقاومة أولى' },
    { label:'R2', value:R2, cls:'res',    hint:'مقاومة ثانية' },
    { label:'S1', value:S1, cls:'sup',    hint:'دعم أول' },
    { label:'S2', value:S2, cls:'sup',    hint:'دعم ثاني' },
  ];

  pivotTableBody.innerHTML = '';
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="${r.cls}">${r.label}</td>
      <td>${r.value.toFixed(2)}</td>
      <td>${(r.value-price>0?'+':'') + (r.value-price).toFixed(2)}</td>
      <td>${r.hint}</td>
    `;
    pivotTableBody.appendChild(tr);
  });

  if (pivotPriceEl){
    pivotPriceEl.textContent = `السعر الحالي المستخدم: ${price.toFixed(2)}`;
  }
}

// ================== Chart ==================
function ensureCharts(){
  if (chart) return;
  const c = $('#chart');
  if (!c || typeof LightweightCharts === 'undefined') return;

  const wrap = document.createElement('div');
  wrap.style.width = '100%';
  wrap.style.height = c.style.height || '280px';
  c.replaceWith(wrap);

  chart = LightweightCharts.createChart(wrap, {
    layout: {
      background: { type:'solid', color:getComputedStyle(document.documentElement).getPropertyValue('--card2').trim() || '#0b0f17' },
      textColor: getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '#e5e7eb'
    },
    rightPriceScale: { borderColor: '#374151' },
    timeScale: { borderColor: '#374151', timeVisible:true, secondsVisible:false },
    grid: {
      vertLines: { color:'#111827' },
      horzLines: { color:'#111827' }
    },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal }
  });
  candleSeries = chart.addCandlestickSeries({
    upColor:'#22c55e', borderUpColor:'#22c55e', wickUpColor:'#22c55e',
    downColor:'#ef4444', borderDownColor:'#ef4444', wickDownColor:'#ef4444'
  });

  const rsiP = $('#rsiPanel');
  if (rsiP){
    const w = document.createElement('div');
    w.style.width='100%';
    w.style.height = rsiP.style.height || '120px';
    rsiP.replaceWith(w);
    rsiChart = LightweightCharts.createChart(w, {
      layout:{ background:{type:'solid', color:getComputedStyle(document.documentElement).getPropertyValue('--card2').trim()||'#0b0f17'}, textColor:getComputedStyle(document.documentElement).getPropertyValue('--fg').trim()||'#e5e7eb'},
      timeScale:{}
    });
    rsiSeries = rsiChart.addLineSeries({ lineWidth:1 });
  }

  const macdP = $('#macdPanel');
  if (macdP){
    const w = document.createElement('div');
    w.style.width='100%';
    w.style.height = macdP.style.height || '140px';
    macdP.replaceWith(w);
    macdChart = LightweightCharts.createChart(w, {
      layout:{ background:{type:'solid', color:getComputedStyle(document.documentElement).getPropertyValue('--card2').trim()||'#0b0f17'}, textColor:getComputedStyle(document.documentElement).getPropertyValue('--fg').trim()||'#e5e7eb'},
      timeScale:{}
    });
    macdSeries = macdChart.addLineSeries({ lineWidth:1 });
  }

  const stochP = $('#stochPanel');
  if (stochP){
    const w = document.createElement('div');
    w.style.width='100%';
    w.style.height = stochP.style.height || '120px';
    stochP.replaceWith(w);
    stochChart = LightweightCharts.createChart(w, {
      layout:{ background:{type:'solid', color:getComputedStyle(document.documentElement).getPropertyValue('--card2').trim()||'#0b0f17'}, textColor:getComputedStyle(document.documentElement).getPropertyValue('--fg').trim()||'#e5e7eb'},
      timeScale:{}
    });
    stochSeries = stochChart.addLineSeries({ lineWidth:1 });
  }

  window.addEventListener('resize', ()=>{
    const rect = wrap.getBoundingClientRect();
    chart.applyOptions({ width:rect.width, height:rect.height });
  });
}

function setBarsOnCharts(bars){
  if (!chart || !candleSeries) return;
  const data = bars.map(b=>({
    time: Math.floor(b.t/1000),
    open: b.o,
    high: b.h,
    low:  b.l,
    close:b.c
  }));
  candleSeries.setData(data);

  const closes = bars.map(b=>b.c);
  const rsiArr = calcRSI(closes, +(rsiPeriodEl?.value||14));
  if (rsiSeries){
    const d = bars.map((b,i)=>({ time:Math.floor(b.t/1000), value:rsiArr[i]??50 }));
    rsiSeries.setData(d);
  }

  const macdObj = calcMACD(closes,
    +(macdFastEl?.value||12),
    +(macdSlowEl?.value||26),
    +(macdSigEl?.value||9)
  );
  if (macdSeries){
    const d = bars.map((b,i)=>({ time:Math.floor(b.t/1000), value:macdObj.macdLine[i]||0 }));
    macdSeries.setData(d);
  }

  const stArr = calcStoch(closes, bars.map(b=>b.h), bars.map(b=>b.l), +(stochKEl?.value||14));
  if (stochSeries){
    const d = bars.map((b,i)=>({ time:Math.floor(b.t/1000), value:stArr[i]??50 }));
    stochSeries.setData(d);
  }
}

// ================== Fetch price & bars ==================
async function fetchPriceOnce(){
  const base = getBase();
  try{
    const r = await fetch(`${base}/price`, { cache:'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (!j.ok || !Number.isFinite(j.price)) throw new Error('رد /price غير صالح');
    const ts = j.ts || Date.now();
    lastLive = { price:j.price, ts, source:j.source || 'worker' };

    if (priceEl) priceEl.textContent = j.price.toFixed(3);
    if (liveDtEl) liveDtEl.textContent = fmtDateTime(ts);
    if (livePriceHidden)  livePriceHidden.textContent  = String(j.price);
    if (liveSourceHidden) liveSourceHidden.textContent = j.source || '';
    if (liveTimeHidden)   liveTimeHidden.textContent   = String(ts);

    logDebug(`سعر حي: ${j.price} من ${j.source || '؟'}`);
  }catch(e){
    logDebug(`فشل جلب السعر الحي: ${e.message}`);
  }
}

function startPriceLoop(){
  fetchPriceOnce();
  setInterval(fetchPriceOnce, 2000); // كل ثانيتين
}

async function fetchBarsAndUpdate(){
  const base = getBase();
  const tfBtn = tfBar?.querySelector('button.primary');
  const tf = tfBtn ? (tfBtn.dataset.tf || '5m') : '5m';
  const L = Math.max(300, Math.min(+(limitIn?.value || 1200), 5000));

  try{
    const url = `${base}/bars?tf=${encodeURIComponent(tf)}&limit=${encodeURIComponent(L)}`;
    const r = await fetch(url, { cache:'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (!Array.isArray(j) || !j.length) throw new Error('لا توجد بيانات شموع');

    // 👇👇 تعديل مهم: تحويل الوقت لأي شكل (رقم أو نص ISO) إلى رقم ms
    lastBars = j.map(b=>{
      let rawT = b.t ?? b.time ?? b.ts ?? b.isoTime ?? b.date ?? 0;
      let t = Number(rawT);
      if (!Number.isFinite(t) && typeof rawT === 'string') {
        const parsed = Date.parse(rawT);
        if (Number.isFinite(parsed)) t = parsed;
      }
      return {
        t,
        o:+b.o,
        h:+b.h,
        l:+b.l,
        c:+b.c,
        v:+(b.v || 0)
      };
    }).filter(b =>
      Number.isFinite(b.t) &&
      Number.isFinite(b.o) &&
      Number.isFinite(b.h) &&
      Number.isFinite(b.l) &&
      Number.isFinite(b.c)
    );

    if (!lastBars.length) throw new Error('كل الشموع مرفوضة (مشكل time)');

    ensureCharts();
    setBarsOnCharts(lastBars);

    const closes = lastBars.map(b=>b.c);
    const market = analyzeMarket(lastBars, closes);
    const advice = computeAdvice(lastBars);
    applyAdvice(advice);

    if (lastLive && lastLive.price) {
      updatePivot(lastBars, lastLive.price);
    } else {
      updatePivot(lastBars, closes[closes.length-1]);
    }

    const last = lastBars[lastBars.length-1];
    logDebug(`تم جلب ${lastBars.length} شمعة. آخر إغلاق: ${last.c}`);

    if (advice.side !== lastSignalSide && advice.side !== 'none') {
      lastSignalSide = advice.side;
      showToastSignal(advice);
    }
  }catch(e){
    logDebug(`فشل جلب الشموع: ${e.message}`);
    lastBars = [];
    applyAdvice({ side:'none', text:'مراقبة فقط', conf:0, entry:null,tp1:null,tp2:null,sl:null, reasons:[] });
  }
}

// ================== Toast / Flash ==================
function flash() {
  if (!flashEl) return;
  flashEl.classList.add('on');
  setTimeout(()=>flashEl.classList.remove('on'), 220);
}

function showToastSignal(ad){
  if (!toastEl) return;
  flash();
  toastTitleEl.textContent = ad.side==='buy' ? 'إشارة شراء' : 'إشارة بيع';
  const parts = [];
  if (ad.entry) parts.push(`دخول: ${ad.entry.toFixed(2)}`);
  if (ad.tp1)   parts.push(`TP1: ${ad.tp1.toFixed(2)}`);
  if (ad.tp2)   parts.push(`TP2: ${ad.tp2.toFixed(2)}`);
  if (ad.sl)    parts.push(`SL: ${ad.sl.toFixed(2)}`);
  toastMsgEl.textContent = parts.join(' • ') || 'إشارة جديدة';
  toastEl.classList.add('show');
}

if (toastCloseEl){
  toastCloseEl.addEventListener('click', ()=> toastEl.classList.remove('show'));
}

// ================== Telegram Notify ==================
async function sendAdviceToTelegram(){
  if (!lastBars || !lastBars.length) return;
  const ad = computeAdvice(lastBars);
  const base = getBase();
  const text = [
    'إشارة GoldSignalsX',
    `النوع: ${ad.side==='buy'?'شراء':ad.side==='sell'?'بيع':'مراقبة'}`,
    ad.entry ? `Entry: ${ad.entry.toFixed(2)}` : '',
    ad.tp1   ? `TP1: ${ad.tp1.toFixed(2)}` : '',
    ad.tp2   ? `TP2: ${ad.tp2.toFixed(2)}` : '',
    ad.sl    ? `SL: ${ad.sl.toFixed(2)}` : '',
    ad.conf  ? `ثقة: ${ad.conf.toFixed(0)}%` : '',
    ad.pattern ? `نمط: ${ad.pattern}` : ''
  ].filter(Boolean).join('\n');

  try{
    const r = await fetch(`${base}/notify`, {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ text })
    });
    const j = await r.json().catch(()=>({}));
    logDebug(`Telegram: ${r.ok?'OK':'FAIL'} ${JSON.stringify(j)}`);
  }catch(e){
    logDebug(`Telegram error: ${e.message}`);
  }
}

// ================== Backtest بسيط ==================
function parseCsv(text){
  const lines = String(text||'').trim().split(/\r?\n/);
  if (lines.length<=1) return [];
  const head = lines[0].toLowerCase();
  const start = head.includes('time') ? 1 : 0;
  const rows = [];
  for(let i=start;i<lines.length;i++){
    const parts = lines[i].split(',');
    if (parts.length<5) continue;
    const [time,o,h,l,c,v] = parts;
    const t = isNaN(Number(time)) ? Date.parse(time) : Number(time);
    if (!Number.isFinite(t)) continue;
    rows.push({ t, o:+o, h:+h, l:+l, c:+c, v:+(v||0) });
  }
  return rows;
}

function runBacktestOnBars(bars){
  if (!bars || bars.length<50) return null;
  let trades = 0;
  let pl = 0;
  let wins = 0;
  let maxDD = 0;
  let equity = 0;
  let ref = 0;

  for(let i=30;i<bars.length-1;i++){
    const slice = bars.slice(0, i+1);
    const ad = computeAdvice(slice);
    if (ad.side==='none' || !ad.entry || !ad.tp1 || !ad.sl) continue;
    trades++;
    const next = bars[i+1];
    let result = 0;
    if (ad.side==='buy'){
      if (next.h >= ad.tp1) result = +(ad.tp1 - ad.entry);
      else if (next.l <= ad.sl) result = +(ad.sl - ad.entry);
    } else {
      if (next.l <= ad.tp1) result = +(ad.entry - ad.tp1);
      else if (next.h >= ad.sl) result = +(ad.entry - ad.sl);
    }
    pl += result;
    equity += result;
    if (equity<ref) maxDD = Math.min(maxDD, equity-ref);
    if (result>0) wins++;
  }
  const winPct = trades ? (wins/trades)*100 : 0;
  return { trades, pl, winPct, maxDD };
}

// ================== Event wiring ==================
function setupUI(){
  if (saveBase) saveBase.addEventListener('click', ()=> setBase(baseIn.value));
  if (baseIn && !baseIn.value) {
    const saved = localStorage.getItem('GSX_BASE_URL');
    baseIn.value = saved || DEFAULT_BASE;
  }

  if (btnPrice) btnPrice.addEventListener('click', fetchPriceOnce);

  if (tfBar){
    tfBar.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click', ()=>{
        tfBar.querySelectorAll('button').forEach(x=>x.classList.remove('primary'));
        b.classList.add('primary');
        fetchBarsAndUpdate();
      });
    });
  }

  if (btnBars) btnBars.addEventListener('click', fetchBarsAndUpdate);

  if (btnCSV){
    btnCSV.addEventListener('click', ()=>{
      const base = getBase();
      const tfBtn = tfBar?.querySelector('button.primary');
      const tf = tfBtn ? (tfBtn.dataset.tf || '5m') : '5m';
      location.href = `${base}/export.csv?tf=${encodeURIComponent(tf)}`;
    });
  }

  if (dbgToggleEl && logEl){
    dbgToggleEl.addEventListener('change', ()=>{
      logEl.style.display = dbgToggleEl.checked ? 'block' : 'none';
    });
  }

  if (btnNotify) btnNotify.addEventListener('click', sendAdviceToTelegram);
  if (btnRecalc) btnRecalc.addEventListener('click', ()=>{
    if (!lastBars || !lastBars.length) return;
    const ad = computeAdvice(lastBars);
    applyAdvice(ad);
  });

  if (btnBacktest && csvFileEl){
    btnBacktest.addEventListener('click', async ()=>{
      let bars = lastBars;
      if (csvFileEl.files && csvFileEl.files[0]){
        const text = await csvFileEl.files[0].text();
        bars = parseCsv(text);
      }
      const res = runBacktestOnBars(bars);
      if (!res){
        btTradesEl.textContent = btPLEl.textContent =
        btWinEl.textContent = btDDEl.textContent = '—';
        return;
      }
      btTradesEl.textContent = String(res.trades);
      btPLEl.textContent     = res.pl.toFixed(2);
      btWinEl.textContent    = res.winPct.toFixed(1)+'%';
      btDDEl.textContent     = res.maxDD.toFixed(2);
    });
  }

  // تفعيل/تعطيل الحقول اليدوية حسب ال Mode
  function toggleManual(selectEl, fields){
    if (!selectEl) return;
    const update = ()=>{
      const isManual = selectEl.value === 'manual';
      fields.forEach(f => {
        if (!f) return;
        f.disabled = !isManual;
      });
    };
    selectEl.addEventListener('change', update);
    update();
  }

  toggleManual(atrModeEl,   [atrPeriodEl]);
  toggleManual(bbModeEl,    [bbPeriodEl, bbStdEl]);
  toggleManual(emaModeEl,   [emaFastInEl, emaSlowInEl]);
  toggleManual(rsiModeEl,   [rsiPeriodEl]);
  toggleManual(macdModeEl,  [macdFastEl, macdSlowEl, macdSigEl]);
  toggleManual(stochModeEl, [stochKEl, stochDEl]);
}

// ================== Bootstrap ==================
document.addEventListener('DOMContentLoaded', ()=>{
  setBase(getBase());
  setupUI();
  ensureCharts();
  startPriceLoop();
  fetchBarsAndUpdate();
});
