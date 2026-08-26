// app_mobile.js — GoldSignalsX • Advanced v4
// يربط واجهة الموبايل مع ال Worker:
//  - /price  → سعر حي
//  - /bars   → شموع + مؤشرات + نصيحة + Pivot + Backtest

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// ================== عناصر الـ DOM ==================

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
const bbOnEl      = $('#bbOn');
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
const regimeTopEl   = $('#regimeTop');
const modeTopEl     = $('#modeTop');
const marketStateEl = $('#marketState');
const feedSourceEl  = $('#feedSource');
const feedAgeEl     = $('#feedAge');
const feedSpreadEl  = $('#feedSpread');

// تبويب النصيحة
const adviceTextEl = $('#adviceText');
const confValEl    = $('#confVal');
const bullScoreValEl = $('#bullScoreVal');
const bearScoreValEl = $('#bearScoreVal');
const mtfValEl       = $('#mtfVal');
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
const autoProfileEl = $('#autoProfile');
const modeProfileTextEl = $('#modeProfileText');
const nyFilterOnEl = $('#nyFilterOn');
const nyStartEl = $('#nyStart');
const nyEndEl = $('#nyEnd');
const pivotFilterOnEl = $('#pivotFilterOn');
const pivotDistanceEl = $('#pivotDistance');

// ================== حالة عامة ==================

const DEFAULT_BASE = 'https://GoldSignalsX-worker.samer-mourtada.workers.dev';

let lastBars = [];
let lastLive = null;   // {price, bid, ask, spread, ts, source}
let lastBarsSource = '';
let lastAnalysisTf = '1m';
let lastMtfBars = []; // [{ tf, bars, source }]
let lastMtfFetchAt = 0;
let lastAdvice = null;
let chart, candleSeries;
let livePriceLine = null;
const tradePriceLines = { entry:null, tp1:null, tp2:null, sl:null };
let rsiChart, rsiSeries;
let macdChart, macdSeries;
let stochChart, stochSeries;

let lastSignalSide = 'none'; // 'buy' | 'sell' | 'none'
let barsRequestRunning = false;
let priceRequestRunning = false;
let liveSocket = null;
let liveSocketBase = '';
let liveSocketRetryId = null;
let lastStreamTickAt = 0;
let lastMarketState = 'رانج';
let applyingModeProfile = false;

const SETTINGS_KEY = 'GSX_SIGNAL_SETTINGS_V2';

const TF_MS = {
  '1m':60000, '5m':300000, '15m':900000, '30m':1800000,
  '60m':3600000, '240m':14400000, '1d':86400000
};
const HIGHER_TF = {
  '1m':['5m','15m'], '5m':['15m','60m'], '15m':['60m','240m'],
  '30m':['60m','240m'], '60m':['240m'], '240m':[], '1d':[]
};

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

function formatAge(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return 'الآن';
  if (ms < 60000) return `${Math.floor(ms / 1000)}ث`;
  return `${Math.floor(ms / 60000)}د`;
}

function refreshFeedStatus() {
  if (!lastLive) return;
  const age = Math.max(0, Date.now() - lastLive.ts);
  if (feedAgeEl) {
    feedAgeEl.textContent = formatAge(age);
    feedAgeEl.style.color = age <= 10000 ? 'var(--ok)' : age <= 60000 ? 'var(--accent)' : 'var(--bad)';
  }
  if (feedSourceEl) {
    const liveSource = lastLive.source || '—';
    const sameSource = !lastBarsSource || lastBarsSource === liveSource;
    feedSourceEl.textContent = sameSource ? liveSource : `${liveSource} / شموع ${lastBarsSource}`;
    feedSourceEl.style.color = sameSource ? 'var(--ok)' : 'var(--accent)';
  }
  if (feedSpreadEl) feedSpreadEl.textContent = Number.isFinite(lastLive.spread) ? lastLive.spread.toFixed(3) : '—';
}

function logDebug(msg) {
  console.log('[GSX]', msg);
  if (!logEl) return;
  const t = `[${new Date().toLocaleTimeString()}] ${msg}\n`;
  logEl.textContent = t + logEl.textContent;
}

// ================== المؤشرات (EMA / RSI / BB / ATR / MACD / Stoch / ADX) ==================

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

// ===== أنماط الشموع اليابانية (اتجاه + قوة + سياق) =====
function detectPattern(bars) {
  const none = { name:'لا يوجد نمط واضح', detail:'', direction:'neutral', strength:0, all:[] };
  if (!bars || bars.length < 3) return none;

  const n = bars.length;
  const a = bars[n-3], b = bars[n-2], c = bars[n-1];
  const body = x => Math.abs(x.c-x.o);
  const range = x => Math.max(x.h-x.l, Number.EPSILON);
  const bull = x => x.c>x.o;
  const bear = x => x.c<x.o;
  const bodyPct = x => body(x)/range(x);
  const upper = x => x.h-Math.max(x.o,x.c);
  const lower = x => Math.min(x.o,x.c)-x.l;
  const prior = bars.slice(Math.max(0,n-9),n-1);
  const swingLow = c.l <= Math.min(...prior.map(x=>x.l));
  const swingHigh = c.h >= Math.max(...prior.map(x=>x.h));
  const priorDown = b.c < bars[Math.max(0,n-5)].c;
  const priorUp = b.c > bars[Math.max(0,n-5)].c;
  const patterns = [];
  const add = (name, direction, strength, detail) => patterns.push({ name, direction, strength, detail });

  const bullEngulf = bear(b) && bull(c) && c.c>=b.o && c.o<=b.c && bodyPct(c)>=0.55;
  const bearEngulf = bull(b) && bear(c) && c.o>=b.c && c.c<=b.o && bodyPct(c)>=0.55;
  if (bullEngulf) add('Bullish Engulfing','bullish',0.82,'ابتلاع شرائي يؤكد انتقال السيطرة للمشترين.');
  if (bearEngulf) add('Bearish Engulfing','bearish',0.82,'ابتلاع بيعي يؤكد انتقال السيطرة للبائعين.');

  const smallB = bodyPct(b)<=0.3;
  if (bear(a) && bodyPct(a)>=0.45 && smallB && bull(c) && c.c>=(a.o+a.c)/2) {
    add('Morning Star','bullish',0.92,'نجمة صباحية من ثلاث شمعات؛ انعكاس صعودي قوي.');
  }
  if (bull(a) && bodyPct(a)>=0.45 && smallB && bear(c) && c.c<=(a.o+a.c)/2) {
    add('Evening Star','bearish',0.92,'نجمة مسائية من ثلاث شمعات؛ انعكاس هبوطي قوي.');
  }

  const hammerShape = bodyPct(c)<=0.38 && lower(c)>=Math.max(body(c)*2,range(c)*0.48) && upper(c)<=range(c)*0.18;
  const starShape = bodyPct(c)<=0.38 && upper(c)>=Math.max(body(c)*2,range(c)*0.48) && lower(c)<=range(c)*0.18;
  if (hammerShape && (swingLow || priorDown)) add('Hammer','bullish',0.68,'مطرقة عند قاع/هبوط قريب؛ تحتاج تأكيد اتجاه.');
  if (starShape && (swingHigh || priorUp)) add('Shooting Star','bearish',0.68,'نجم ساقط عند قمة/صعود قريب؛ يحتاج تأكيد اتجاه.');

  if (bear(b) && bull(c) && c.o<b.c && c.c>(b.o+b.c)/2 && c.c<b.o) {
    add('Piercing Line','bullish',0.72,'اختراق شرائي لأكثر من نصف جسم الشمعة السابقة.');
  }
  if (bull(b) && bear(c) && c.o>b.c && c.c<(b.o+b.c)/2 && c.c>b.o) {
    add('Dark Cloud Cover','bearish',0.72,'غطاء سحابي داكن؛ ضغط بيعي بعد صعود.');
  }

  const cInsideB = Math.max(c.o,c.c)<=Math.max(b.o,b.c) && Math.min(c.o,c.c)>=Math.min(b.o,b.c);
  if (cInsideB && body(c)<=body(b)*0.5 && bear(b) && bull(c)) add('Bullish Harami','bullish',0.56,'هارامي شرائي؛ إشارة انعكاس متوسطة.');
  if (cInsideB && body(c)<=body(b)*0.5 && bull(b) && bear(c)) add('Bearish Harami','bearish',0.56,'هارامي بيعي؛ إشارة انعكاس متوسطة.');

  const longBull = x => bull(x) && bodyPct(x)>=0.5;
  const longBear = x => bear(x) && bodyPct(x)>=0.5;
  if (longBull(a) && longBull(b) && longBull(c) && a.c<b.c && b.c<c.c) {
    add('Three White Soldiers','bullish',0.88,'ثلاثة جنود بيض؛ استمرار/انعكاس صعودي قوي.');
  }
  if (longBear(a) && longBear(b) && longBear(c) && a.c>b.c && b.c>c.c) {
    add('Three Black Crows','bearish',0.88,'ثلاثة غربان سود؛ استمرار/انعكاس هبوطي قوي.');
  }

  if (bodyPct(c)<=0.1) add('Doji','neutral',0.35,'دوجي؛ تردد ولا تُستخدم وحدها للدخول.');
  if (!patterns.length) return none;
  patterns.sort((x,y)=>y.strength-x.strength);
  return { ...patterns[0], all:patterns };
}

// ===== تحليل السوق / Regime + تحديث المؤشرات على الشاشة =====
function analyzeMarket(bars, closes){
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

  const trendBias = (pdi!=null && mdi!=null) ? (pdi>mdi ? 'صاعد' : 'هابط') : (slopePct>0?'صاعد':'هابط');

  let state = 'حيادي';
  const BW_TIGHT = 1.2, BW_WIDE=1.8, SLOPE_OK=0.03, ATR_OK=0.8, ATR_LOW=0.5, ADX_TREND=22;

  if (bandwidthPct < BW_TIGHT && (isFinite(atrPct)? atrPct<ATR_LOW : true) && (adx==null || adx<ADX_TREND)) {
    state = 'رانج';
  } else if (bandwidthPct > BW_WIDE && Math.abs(slopePct) > SLOPE_OK && (isFinite(atrPct)? atrPct>ATR_OK : true) && (adx==null || adx>=ADX_TREND)) {
    state = `ترند ${trendBias}`;
  } else {
    if (adx!=null && adx>=ADX_TREND) state = `ترند ${trendBias}`;
    else state = 'رانج';
  }

  lastMarketState=state;
  applyModeProfile(state);

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

// ===== نصيحة الدخول/الخروج =====
function chooseMode(){
  if (modeSafeEl?.checked)  return 'safe';
  if (modeFastEl?.checked)  return 'fast';
  return 'smart';
}

function indicatorEnabled(el){
  return el ? !!el.checked : true;
}

function modeIndicatorProfile(mode, marketState='رانج'){
  const trend = String(marketState).includes('ترند');
  if (mode==='fast') return { ema:true, macd:true, rsi:true, stoch:false, bb:false };
  if (trend && mode==='safe') return { ema:true, macd:true, rsi:true, stoch:false, bb:true };
  if (trend) return { ema:true, macd:true, rsi:true, stoch:false, bb:false };
  return { ema:false, macd:false, rsi:true, stoch:true, bb:true };
}

function applyModeProfile(marketState=lastMarketState){
  const mode=chooseMode();
  const profile=modeIndicatorProfile(mode,marketState);
  const autoOn=autoProfileEl ? autoProfileEl.checked : false;
  if (autoOn) {
    applyingModeProfile=true;
    if (emaOnEl) emaOnEl.checked=profile.ema;
    if (macdOnEl) macdOnEl.checked=profile.macd;
    if (rsiOnEl) rsiOnEl.checked=profile.rsi;
    if (stochOnEl) stochOnEl.checked=profile.stoch;
    if (bbOnEl) bbOnEl.checked=profile.bb;
    applyingModeProfile=false;
  }
  if (modeProfileTextEl) {
    const shown=autoOn?profile:{ema:indicatorEnabled(emaOnEl),macd:indicatorEnabled(macdOnEl),rsi:indicatorEnabled(rsiOnEl),stoch:indicatorEnabled(stochOnEl),bb:indicatorEnabled(bbOnEl)};
    const names=[];
    if (shown.ema) names.push('EMA');
    if (shown.macd) names.push('MACD');
    if (shown.rsi) names.push('RSI');
    if (shown.stoch) names.push('Stoch');
    if (shown.bb) names.push('BB');
    const label=mode==='safe'?'حذر':mode==='fast'?'سريع':'ذكي';
    modeProfileTextEl.textContent=`${label} • ${String(marketState).includes('ترند')?'ترند':'رانج'} • ${names.join(' + ')}${autoOn?'':' (يدوي)'}`;
  }
  return profile;
}

function nyClockMinutes(ts){
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hour12:false
  }).formatToParts(new Date(ts));
  const h=Number(parts.find(p=>p.type==='hour')?.value);
  const m=Number(parts.find(p=>p.type==='minute')?.value);
  return Number.isFinite(h)&&Number.isFinite(m) ? (h%24)*60+m : NaN;
}

function parseClock(value,fallback){
  const match=String(value||'').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const h=Number(match[1]),m=Number(match[2]);
  return h>=0&&h<=23&&m>=0&&m<=59 ? h*60+m : fallback;
}

function inNyTradingWindow(ts,start='08:00',end='17:00'){
  const now=nyClockMinutes(ts);
  const from=parseClock(start,8*60), to=parseClock(end,17*60);
  if (!Number.isFinite(now)) return false;
  return from<=to ? now>=from&&now<=to : now>=from||now<=to;
}

function nyDateKey(ts){
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date(ts));
  const get=type=>parts.find(p=>p.type===type)?.value||'';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function calculateDailyPivots(bars){
  if (!Array.isArray(bars)||bars.length<2) return null;
  const days=[];
  let current=null;
  for (const bar of bars) {
    const ts=Number(bar?.t), h=Number(bar?.h), l=Number(bar?.l), c=Number(bar?.c);
    if (![ts,h,l,c].every(Number.isFinite)) continue;
    const key=nyDateKey(ts);
    if (!current||current.key!==key) {
      current={key,high:h,low:l,close:c};
      days.push(current);
    } else {
      current.high=Math.max(current.high,h);
      current.low=Math.min(current.low,l);
      current.close=c;
    }
  }
  if (days.length<2) return null;
  const day=days.at(-2);
  const P=(day.high+day.low+day.close)/3;
  const range=day.high-day.low;
  return {
    date:day.key,
    P,
    R1:2*P-day.low,
    S1:2*P-day.high,
    R2:P+range,
    S2:P-range,
    R3:day.high+2*(P-day.low),
    S3:day.low-2*(day.high-P)
  };
}

function nearestPivot(price,pivots){
  if (!Number.isFinite(price)||!pivots) return null;
  const points=['P','R1','R2','R3','S1','S2','S3']
    .map(label=>({label,value:Number(pivots[label])}))
    .filter(point=>Number.isFinite(point.value))
    .map(point=>({...point,distance:Math.abs(price-point.value)}))
    .sort((a,b)=>a.distance-b.distance);
  return points[0]||null;
}

function timeframeBias(bars) {
  if (!bars || bars.length<40) return { direction:'neutral', strength:0 };
  const closes = bars.map(b=>b.c);
  const fast = ema(closes,10).at(-1);
  const slow = ema(closes,34).at(-1);
  const macd = calcMACD(closes,12,26,9);
  const hist = macd.hist.at(-1);
  const { plusDI, minusDI, ADX } = calcADX(bars,14);
  const adx = ADX.at(-1), pdi = plusDI.at(-1), mdi = minusDI.at(-1);
  let bull=0, bear=0;
  if (fast>slow && closes.at(-1)>fast) bull+=2;
  if (fast<slow && closes.at(-1)<fast) bear+=2;
  if (Number.isFinite(hist)) hist>0 ? bull++ : hist<0 ? bear++ : 0;
  if (Number.isFinite(adx) && adx>=18 && Number.isFinite(pdi) && Number.isFinite(mdi)) pdi>mdi ? bull++ : bear++;
  const diff=bull-bear;
  return { direction:diff>=1.5?'bullish':diff<=-1.5?'bearish':'neutral', strength:Math.min(1,Math.abs(diff)/4) };
}

function computeAdvice(bars, context={}){
  const empty = (text,reasons=[]) => ({ side:'none', text, conf:0, entry:null,tp1:null,tp2:null,sl:null,reasons,pattern:'لا يوجد نمط واضح' });
  if (!bars || bars.length<40) return empty('بيانات غير كافية',['نحتاج 40 شمعة مكتملة على الأقل.']);

  const closes=bars.map(b=>b.c), highs=bars.map(b=>b.h), lows=bars.map(b=>b.l);
  const emaFlen=+(emaFastInEl?.value||10), emaSlen=+(emaSlowInEl?.value||34);
  const eFast=ema(closes,emaFlen), eSlow=ema(closes,emaSlen);
  const rsiArr=calcRSI(closes,+(rsiPeriodEl?.value||14));
  const stArr=calcStoch(closes,highs,lows,+(stochKEl?.value||14));
  const macd=calcMACD(closes,+(macdFastEl?.value||12),+(macdSlowEl?.value||26),+(macdSigEl?.value||9));
  const { ma,upper,lower }=calcBB(closes,+(bbPeriodEl?.value||20),+(bbStdEl?.value||2));
  const atr=calcATR(bars,+(atrPeriodEl?.value||14)).at(-1);
  const { ADX,plusDI,minusDI }=calcADX(bars,14);
  const C=closes.at(-1), ef=eFast.at(-1), es=eSlow.at(-1);
  const rsi=rsiArr.at(-1), st=stArr.at(-1), stPrev=stArr.at(-2);
  const hist=macd.hist.at(-1), histPrev=macd.hist.at(-2);
  const adx=ADX.at(-1), pdi=plusDI.at(-1), mdi=minusDI.at(-1);
  const M=ma.at(-1), U=upper.at(-1), L=lower.at(-1);
  const pat=detectPattern(bars);
  const mode=chooseMode();
  if (modeTopEl) modeTopEl.textContent=mode==='safe'?'حذر':mode==='fast'?'سريع':'ذكي';

  if (!Number.isFinite(atr) || atr<=0) return empty('مراقبة فقط',['ATR غير صالح؛ لا يمكن ضبط المخاطرة بدقة.']);
  const tf=context.tf||'1m';
  if (context.enforceFresh) {
    const lastTs=Number(bars.at(-1)?.t);
    const maxAge=Math.max((TF_MS[tf]||60000)*3,7*60000);
    if (!Number.isFinite(lastTs) || Date.now()-lastTs>maxAge) {
      return empty('مراقبة فقط',['بيانات الشموع قديمة؛ تم منع الإشارة حتى تصل شموع حديثة.']);
    }
    const quoteTs=Number(context.live?.ts);
    const quotePrice=Number(context.live?.price);
    const quoteAge=Date.now()-quoteTs;
    if (!Number.isFinite(quoteTs) || !Number.isFinite(quotePrice) || quoteAge<0 || quoteAge>60000) {
      return empty('مراقبة فقط',['السعر الحي مفقود أو أقدم من 60 ثانية؛ تم منع الإشارة.']);
    }
  }

  let bullScore=0, bearScore=0;
  const bullReasons=[], bearReasons=[], neutralReasons=[];
  const useEMA=indicatorEnabled(emaOnEl);
  const useMACD=indicatorEnabled(macdOnEl);
  const useRSI=indicatorEnabled(rsiOnEl);
  const useStoch=indicatorEnabled(stochOnEl);
  const useBB=indicatorEnabled(bbOnEl);
  const trendUp=ef>es && C>ef, trendDown=ef<es && C<ef;
  if (useEMA&&trendUp){ bullScore+=2.5; bullReasons.push('EMA تؤكد اتجاهاً صاعداً'); }
  if (useEMA&&trendDown){ bearScore+=2.5; bearReasons.push('EMA تؤكد اتجاهاً هابطاً'); }

  if (useMACD&&Number.isFinite(hist)) {
    if (hist>0){ bullScore+=1.25; bullReasons.push('زخم MACD موجب'); }
    if (hist<0){ bearScore+=1.25; bearReasons.push('زخم MACD سالب'); }
    if (Number.isFinite(histPrev) && hist>histPrev) bullScore+=0.35;
    if (Number.isFinite(histPrev) && hist<histPrev) bearScore+=0.35;
  }
  if (Number.isFinite(adx) && adx>=18 && Number.isFinite(pdi) && Number.isFinite(mdi)) {
    if (pdi>mdi){ bullScore+=1; bullReasons.push(`+DI يتفوّق مع ADX ${adx.toFixed(1)}`); }
    else { bearScore+=1; bearReasons.push(`-DI يتفوّق مع ADX ${adx.toFixed(1)}`); }
  } else neutralReasons.push('ADX ضعيف؛ لا نعتمد الاتجاه وحده');

  if (useRSI&&Number.isFinite(rsi)) {
    if (rsi>=52 && rsi<70) bullScore+=0.8;
    else if (rsi<=48 && rsi>30) bearScore+=0.8;
    else if (rsi>=70 || rsi<=30) neutralReasons.push(`RSI ${rsi.toFixed(1)} متطرف؛ لا يُستخدم وحده كإشارة انعكاس`);
  }
  if (useStoch&&Number.isFinite(st) && Number.isFinite(stPrev)) {
    if (st<40 && st>stPrev) bullScore+=0.55;
    if (st>60 && st<stPrev) bearScore+=0.55;
  }
  if (useBB&&Number.isFinite(M)) C>M ? bullScore+=0.45 : bearScore+=0.45;
  if (useBB&&Number.isFinite(U) && C>U) bullScore+=0.35;
  if (useBB&&Number.isFinite(L) && C<L) bearScore+=0.35;

  if (pat.direction==='bullish'){
    bullScore+=pat.strength*2.5;
    bullReasons.push(`${pat.name}: ${pat.detail}`);
  } else if (pat.direction==='bearish'){
    bearScore+=pat.strength*2.5;
    bearReasons.push(`${pat.name}: ${pat.detail}`);
  } else if (pat.name==='Doji') neutralReasons.push(pat.detail);

  const last=bars.at(-1), prev=bars.at(-2);
  const lastRange=Math.max(last.h-last.l,Number.EPSILON);
  const lastBody=Math.abs(last.c-last.o);
  const bullishCandle=(last.c>last.o && lastBody/lastRange>=0.52 && last.c>=last.h-lastRange*0.2) || last.c>prev.h || pat.direction==='bullish';
  const bearishCandle=(last.c<last.o && lastBody/lastRange>=0.52 && last.c<=last.l+lastRange*0.2) || last.c<prev.l || pat.direction==='bearish';
  if (bullishCandle){ bullScore+=1.15; bullReasons.push('إغلاق الشمعة يؤكد ضغطاً شرائياً'); }
  if (bearishCandle){ bearScore+=1.15; bearReasons.push('إغلاق الشمعة يؤكد ضغطاً بيعياً'); }

  let mtfBull=0, mtfBear=0, mtfNeutral=0;
  for (const frame of (context.mtf||[])) {
    const bias=timeframeBias(frame.bars);
    if (bias.direction==='bullish'){
      mtfBull++;
      bullScore+=1.6+0.6*bias.strength;
      bullReasons.push(`الإطار ${frame.tf} صاعد`);
    } else if (bias.direction==='bearish'){
      mtfBear++;
      bearScore+=1.6+0.6*bias.strength;
      bearReasons.push(`الإطار ${frame.tf} هابط`);
    } else {
      mtfNeutral++;
      neutralReasons.push(`الإطار ${frame.tf} حيادي`);
    }
  }

  const leader=bullScore>=bearScore?'buy':'sell';
  const leaderScore=Math.max(bullScore,bearScore), opponentScore=Math.min(bullScore,bearScore);
  const margin=leaderScore-opponentScore;
  const confirmations=leader==='buy'?mtfBull:mtfBear;
  const oppositions=leader==='buy'?mtfBear:mtfBull;
  const candleConfirmed=leader==='buy'?bullishCandle:bearishCandle;
  const threshold=mode==='fast'?5.8:mode==='safe'?9.2:7.4;
  const mtfAvailable=(context.mtf||[]).length;
  const expectedMtf=Number.isFinite(context.expectedMtf)?context.expectedMtf:mtfAvailable;
  const requiredMtf=context.enforceMTF ? (mode==='safe'?Math.min(2,expectedMtf):Math.min(1,expectedMtf)) : 0;
  const reasons=leader==='buy'?bullReasons:bearReasons;

  if (leaderScore<threshold) neutralReasons.unshift(`النقاط ${leaderScore.toFixed(1)} أقل من حد ${threshold.toFixed(1)}`);
  if (margin<2) neutralReasons.unshift('تعارض واضح بين أدلة الشراء والبيع');
  if (!candleConfirmed) neutralReasons.unshift('لا يوجد إغلاق شمعة مؤكِّد للاتجاه');
  if (confirmations<requiredMtf) neutralReasons.unshift(`تأكيد MTF غير كافٍ (${confirmations}/${requiredMtf})`);
  if (oppositions>confirmations && mtfAvailable) neutralReasons.unshift('الأطر الأعلى تعاكس الإشارة الحالية');

  let nyBlocked=false, pivotBlocked=false;
  if (nyFilterOnEl?.checked) {
    const filterTs=Number(context.live?.ts)||Number(bars.at(-1)?.t);
    nyBlocked=!inNyTradingWindow(filterTs,nyStartEl?.value||'08:00',nyEndEl?.value||'17:00');
    if (nyBlocked) neutralReasons.unshift(`خارج جلسة نيويورك (${nyStartEl?.value||'08:00'}–${nyEndEl?.value||'17:00'})`);
  }
  if (pivotFilterOnEl?.checked) {
    const pivots=context.pivots||calculateDailyPivots(bars);
    const nearest=nearestPivot(C,pivots);
    const minDistance=Math.max(0,Number(pivotDistanceEl?.value||0.7));
    if (!pivots) {
      pivotBlocked=true;
      neutralReasons.unshift('Pivot اليومي غير متوفر؛ تم منع الإشارة احتياطياً');
    } else if (nearest&&nearest.distance<minDistance) {
      pivotBlocked=true;
      neutralReasons.unshift(`السعر قريب من ${nearest.label} (${nearest.distance.toFixed(2)}$ < ${minDistance.toFixed(2)}$)`);
    }
  }

  let side=(leaderScore>=threshold && margin>=2 && candleConfirmed && confirmations>=requiredMtf && !(oppositions>confirmations && mtfAvailable) && !nyBlocked && !pivotBlocked)?leader:'none';
  const liveSource=context.live?.source||'';
  const barsSource=context.barsSource||'';
  const livePrice=Number(context.live?.price);
  const liveAge=Date.now()-Number(context.live?.ts||0);
  const priceGap=Number.isFinite(livePrice)?Math.abs(livePrice-C):Infinity;
  const priceAligned=priceGap<=Math.max(atr*0.75,C*0.002);
  const storedBars=barsSource==='d1'||barsSource==='kv';
  const sameProvider=!liveSource || !barsSource || liveSource===barsSource || (liveSource.startsWith('gold-ticks') && barsSource==='gold-ticks');
  const sourceConsistent=sameProvider || (storedBars && priceAligned);
  if (!sourceConsistent) neutralReasons.unshift(`السعر (${liveSource}) والشموع (${barsSource}) غير متوافقين؛ تم منع الإشارة`);
  if (!priceAligned) neutralReasons.unshift(`فرق السعر الحي عن آخر شمعة كبير (${priceGap.toFixed(2)}$)؛ تم منع الإشارة`);
  if (!sourceConsistent || !priceAligned) side='none';

  if (side==='none') return { ...empty('مراقبة فقط',[...neutralReasons,...reasons.slice(0,3)]), pattern:pat.name, bullScore, bearScore, mtf:{bull:mtfBull,bear:mtfBear,neutral:mtfNeutral} };

  let entry=C;
  if (sourceConsistent && Number.isFinite(livePrice) && liveAge<=60000 && priceAligned) entry=livePrice;
  else if (Number.isFinite(livePrice)) neutralReasons.push('الدخول مبني على إغلاق الشمعة لأن السعر الحي غير موحّد/بعيد');

  const recent=bars.slice(-6);
  const structural=side==='buy'?Math.min(...recent.map(x=>x.l)):Math.max(...recent.map(x=>x.h));
  const minRisk=atr*(mode==='fast'?0.8:mode==='safe'?1.2:1.0);
  const maxRisk=atr*(mode==='safe'?2.2:1.8);
  const structuralRisk=side==='buy'?entry-(structural-atr*0.15):(structural+atr*0.15)-entry;
  const risk=Math.min(maxRisk,Math.max(minRisk,structuralRisk));
  const sl=side==='buy'?entry-risk:entry+risk;
  const rr1=mode==='fast'?1.0:mode==='safe'?1.5:1.25;
  const rr2=mode==='fast'?1.7:mode==='safe'?2.5:2.1;
  const tp1=side==='buy'?entry+risk*rr1:entry-risk*rr1;
  const tp2=side==='buy'?entry+risk*rr2:entry-risk*rr2;
  let conf=55+(leaderScore-threshold)*6+confirmations*5+(candleConfirmed?4:0)-Math.max(0,opponentScore-2)*1.5;
  conf=Math.max(55,Math.min(mode==='safe'?92:mode==='fast'?82:88,conf));
  if (!sourceConsistent) conf=Math.min(conf,72);
  if (conf<60) side='none';

  return {
    side,
    text:side==='buy'?'إشارة شراء مؤكدة':side==='sell'?'إشارة بيع مؤكدة':'مراقبة فقط',
    conf:side==='none'?0:conf,
    entry:side==='none'?null:entry,
    tp1:side==='none'?null:tp1,
    tp2:side==='none'?null:tp2,
    sl:side==='none'?null:sl,
    reasons:[...reasons,...neutralReasons].slice(0,8),
    pattern:pat.name,
    bullScore,bearScore,
    mtf:{bull:mtfBull,bear:mtfBear,neutral:mtfNeutral}
  };
}

function applyAdvice(ad) {
  lastAdvice = ad;
  if (!adviceTextEl) return;
  adviceTextEl.textContent = ad.text;
  if (confValEl)  confValEl.textContent  = ad.conf ? ad.conf.toFixed(0)+'%' : '—';
  if (bullScoreValEl) bullScoreValEl.textContent=Number.isFinite(ad.bullScore)?ad.bullScore.toFixed(1):'—';
  if (bearScoreValEl) bearScoreValEl.textContent=Number.isFinite(ad.bearScore)?ad.bearScore.toFixed(1):'—';
  if (mtfValEl) {
    const mtf=ad.mtf||{};
    mtfValEl.textContent=`↑${mtf.bull||0} / ↓${mtf.bear||0} / —${mtf.neutral||0}`;
  }
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
  updateTradePriceLines(ad);
}

// ===== Pivot =====
function updatePivot(bars, livePrice){
  if (!pivotTableBody || !bars || !bars.length) return;
  const pivots=calculateDailyPivots(bars);
  const price=Number(livePrice)||Number(bars.at(-1)?.c);
  if (!pivots) {
    pivotTableBody.innerHTML='<tr><td colspan="4">نحتاج بيانات من يومَي نيويورك على الأقل لحساب Pivot بدقة.</td></tr>';
    if (pivotPriceEl) pivotPriceEl.textContent=Number.isFinite(price)?`السعر الحالي المستخدم: ${price.toFixed(2)}`:'—';
    return;
  }

  const rows = [
    { label:'Pivot', value:pivots.P, cls:'pivot', hint:'المركز المحوري لليوم' },
    { label:'R1', value:pivots.R1, cls:'res',    hint:'مقاومة أولى' },
    { label:'R2', value:pivots.R2, cls:'res',    hint:'مقاومة ثانية' },
    { label:'S1', value:pivots.S1, cls:'sup',    hint:'دعم أول' },
    { label:'S2', value:pivots.S2, cls:'sup',    hint:'دعم ثاني' },
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
    pivotPriceEl.textContent = `محسوب من جلسة ${pivots.date} • السعر الحالي: ${price.toFixed(2)}`;
  }
}

// ===== Charts (Lightweight Charts) =====
function ensureCharts(){
  if (chart) return;
  const c = $('#chart');
  if (!c || typeof LightweightCharts === 'undefined') return;

  const wrap = document.createElement('div');
  wrap.style.width = '100%';
  // استخدم الارتفاع الحقيقي من الـ canvas أو قيمة افتراضية
  const cRect = c.getBoundingClientRect();
  const h = (cRect.height && cRect.height > 0) ? cRect.height : 280;
  wrap.style.height = h + 'px';
  c.replaceWith(wrap);

  chart = LightweightCharts.createChart(wrap, {
    layout: {
      background: {
        type:'solid',
        color:getComputedStyle(document.documentElement).getPropertyValue('--card2').trim() || '#0b0f17'
      },
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
    const rRect = rsiP.getBoundingClientRect();
    const rh = (rRect.height && rRect.height>0) ? rRect.height : 120;
    w.style.height = rh + 'px';
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
    const mRect = macdP.getBoundingClientRect();
    const mh = (mRect.height && mRect.height>0) ? mRect.height : 140;
    w.style.height = mh + 'px';
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
    const sRect = stochP.getBoundingClientRect();
    const sh = (sRect.height && sRect.height>0) ? sRect.height : 120;
    w.style.height = sh + 'px';
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

  updateLivePriceLine();
  updateTradePriceLines(lastAdvice);
}

function replacePriceLine(current, value, options) {
  if (!candleSeries) return null;
  if (current) {
    try { candleSeries.removePriceLine(current); } catch {}
  }
  if (!Number.isFinite(value)) return null;
  return candleSeries.createPriceLine({
    price: value,
    axisLabelVisible: true,
    title: options.title,
    color: options.color,
    lineWidth: options.lineWidth || 2,
    lineStyle: options.lineStyle ?? LightweightCharts.LineStyle.Dashed
  });
}

function updateLivePriceLine() {
  livePriceLine = replacePriceLine(livePriceLine, Number(lastLive?.price), {
    title: 'Live',
    color: '#3b82f6',
    lineWidth: 2,
    lineStyle: LightweightCharts?.LineStyle?.Solid ?? 0
  });
}

function updateTradePriceLines(ad) {
  const active = ad && (ad.side === 'buy' || ad.side === 'sell');
  tradePriceLines.entry = replacePriceLine(tradePriceLines.entry, active ? Number(ad.entry) : NaN, { title:'Entry', color:'#f8fafc' });
  tradePriceLines.tp1   = replacePriceLine(tradePriceLines.tp1,   active ? Number(ad.tp1)   : NaN, { title:'TP1', color:'#22c55e' });
  tradePriceLines.tp2   = replacePriceLine(tradePriceLines.tp2,   active ? Number(ad.tp2)   : NaN, { title:'TP2', color:'#16a34a' });
  tradePriceLines.sl    = replacePriceLine(tradePriceLines.sl,    active ? Number(ad.sl)    : NaN, { title:'SL', color:'#ef4444' });
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
  chart.timeScale().setVisibleLogicalRange({
    from: Math.max(0, data.length - 100),
    to: data.length + 5
  });

  const closes = bars.map(b=>b.c);
  const rsiArr = calcRSI(closes, +(rsiPeriodEl?.value||14));
  if (rsiSeries){
    const d = bars.map((b,i)=>({ time:Math.floor(b.t/1000), value:rsiArr[i]??50 }));
    rsiSeries.setData(d);
    rsiChart.timeScale().setVisibleLogicalRange({ from: Math.max(0, d.length - 100), to: d.length + 5 });
  }

  const macdObj = calcMACD(closes,
    +(macdFastEl?.value||12),
    +(macdSlowEl?.value||26),
    +(macdSigEl?.value||9)
  );
  if (macdSeries){
    const d = bars.map((b,i)=>({ time:Math.floor(b.t/1000), value:macdObj.macdLine[i]||0 }));
    macdSeries.setData(d);
    macdChart.timeScale().setVisibleLogicalRange({ from: Math.max(0, d.length - 100), to: d.length + 5 });
  }

  const stArr = calcStoch(closes, bars.map(b=>b.h), bars.map(b=>b.l), +(stochKEl?.value||14));
  if (stochSeries){
    const d = bars.map((b,i)=>({ time:Math.floor(b.t/1000), value:stArr[i]??50 }));
    stochSeries.setData(d);
    stochChart.timeScale().setVisibleLogicalRange({ from: Math.max(0, d.length - 100), to: d.length + 5 });
  }
}

// ===== جلب السعر الحي =====
function normalizeStreamQuote(payload){
  if (!payload || payload.event !== 'price') return null;
  const price=Number(payload.price);
  let ts=Number(payload.ts ?? payload.timestamp);
  if (!Number.isFinite(price)) return null;
  if (!Number.isFinite(ts)) ts=Date.now();
  else if (ts<1e12) ts*=1000;
  return {
    price,
    bid:Number(payload.bid),
    ask:Number(payload.ask),
    spread:Number(payload.spread),
    ts,
    source:payload.source || 'twelve-data'
  };
}

function applyLiveQuote(quote){
  if (!quote || !Number.isFinite(quote.price)) return false;
  lastLive={
    price:Number(quote.price),
    bid:Number(quote.bid),
    ask:Number(quote.ask),
    spread:Number(quote.spread),
    ts:Number(quote.ts || Date.now()),
    source:quote.source || 'worker'
  };

  if (priceEl) priceEl.textContent=lastLive.price.toFixed(3);
  if (liveDtEl) liveDtEl.textContent=fmtDateTime(lastLive.ts);
  if (livePriceHidden) livePriceHidden.textContent=String(lastLive.price);
  if (liveSourceHidden) liveSourceHidden.textContent=lastLive.source;
  if (liveTimeHidden) liveTimeHidden.textContent=String(lastLive.ts);

  refreshFeedStatus();
  updateLivePriceLine();
  if (lastBars.length) updatePivot(lastBars,lastLive.price);
  return true;
}

async function fetchPriceOnce(){
  if (priceRequestRunning) return;
  priceRequestRunning=true;
  const base = getBase();
  try{
    const r = await fetch(`${base}/price`, { cache:'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (!j.ok || !Number.isFinite(j.price)) throw new Error('رد /price غير صالح');
    const ts=j.ts || Date.now();
    applyLiveQuote({
      price:Number(j.price),
      bid:Number(j.bid),
      ask:Number(j.ask),
      spread:Number(j.spread),
      ts:Number(ts),
      source:j.source || 'worker'
    });

    logDebug(`سعر حي: ${j.price} من ${j.source || '؟'}${Number.isFinite(j.spread) ? ` • spread ${Number(j.spread).toFixed(3)}` : ''}`);
  }catch(e){
    logDebug(`فشل جلب السعر الحي: ${e.message}`);
    if (feedAgeEl) {
      feedAgeEl.textContent = 'منقطع';
      feedAgeEl.style.color = 'var(--bad)';
    }
  }finally{
    priceRequestRunning=false;
  }
}

function stopLiveStream(){
  if (liveSocketRetryId){
    clearTimeout(liveSocketRetryId);
    liveSocketRetryId=null;
  }
  if (liveSocket){
    const socket=liveSocket;
    liveSocket=null;
    try{ socket.close(1000,'reconnect'); }catch{}
  }
  liveSocketBase='';
}

function scheduleStreamReconnect(){
  if (liveSocketRetryId) return;
  liveSocketRetryId=setTimeout(()=>{
    liveSocketRetryId=null;
    connectLiveStream();
  },5000);
}

function connectLiveStream(){
  if (typeof WebSocket==='undefined') return;
  const base=getBase();
  if (liveSocket && liveSocketBase===base && liveSocket.readyState<2) return;
  stopLiveStream();
  liveSocketBase=base;
  const wsUrl=`${base.replace(/^http/i,'ws')}/stream`;

  try{
    const socket=new WebSocket(wsUrl);
    liveSocket=socket;
    socket.addEventListener('open',()=>logDebug('اتصل البث الحي Twelve Data'));
    socket.addEventListener('message',(event)=>{
      let payload;
      try{ payload=JSON.parse(event.data); }catch{ return; }
      const quote=normalizeStreamQuote(payload);
      if (quote && applyLiveQuote(quote)){
        lastStreamTickAt=Date.now();
        logDebug(`سعر لحظي: ${quote.price} من ${quote.source}`);
        return;
      }
      if (payload?.event==='error' || payload?.status==='error'){
        logDebug(`بث Twelve Data: ${payload.message || payload.code || 'غير متاح'}`);
      }
    });
    socket.addEventListener('close',()=>{
      if (liveSocket===socket) liveSocket=null;
      scheduleStreamReconnect();
    });
    socket.addEventListener('error',()=>{
      logDebug('بث Twelve Data غير متاح، الانتقال للمصدر الاحتياطي');
    });
  }catch(e){
    logDebug(`تعذّر فتح البث: ${e.message}`);
    scheduleStreamReconnect();
  }
}

function startPriceLoop(){
  connectLiveStream();
  fetchPriceOnce();
  setInterval(()=>{
    // REST remains a safety net, but never overwrites a fresh WebSocket tick.
    if (!lastStreamTickAt || Date.now()-lastStreamTickAt>15000) fetchPriceOnce();
  },3000);
  setInterval(refreshFeedStatus, 1000);
}

// ===== جلب الشموع من /bars =====
function normalizeCompletedBars(rows,tf) {
  const duration=TF_MS[tf]||60000;
  const now=Date.now();
  const mapped=(Array.isArray(rows)?rows:[]).map(b=>{
    const rawT=b.t??b.time??b.ts??b.isoTime??b.date??0;
    let t=typeof rawT==='string'?Date.parse(rawT):Number(rawT);
    if (Number.isFinite(t) && t<1e12) t*=1000;
    return { t,o:+b.o,h:+b.h,l:+b.l,c:+b.c,v:+(b.v||0),complete:b.complete };
  }).filter(b=>
    Number.isFinite(b.t) && Number.isFinite(b.o) && Number.isFinite(b.h) &&
    Number.isFinite(b.l) && Number.isFinite(b.c) && b.h>=b.l && b.complete!==false
  ).sort((a,b)=>a.t-b.t);

  // OANDA marks completed candles explicitly. Fallback sources do not, so
  // reject any candle whose time bucket has not closed yet.
  return mapped.filter(b=>b.complete===true || b.t+duration<=now+2000);
}

async function fetchBarsFrame(base,tf,limit) {
  const url=`${base}/bars?tf=${encodeURIComponent(tf)}&limit=${encodeURIComponent(limit)}`;
  const response=await fetch(url,{cache:'no-store'});
  if (!response.ok) throw new Error(`${tf}: HTTP ${response.status}`);
  const source=response.headers.get('x-gsx-source')||'';
  const rows=await response.json();
  const bars=normalizeCompletedBars(rows,tf);
  if (!bars.length) throw new Error(`${tf}: لا توجد شموع مكتملة`);
  return {tf,bars,source};
}

async function fetchBarsAndUpdate(){
  if (barsRequestRunning) return;
  barsRequestRunning = true;
  const base = getBase();
  const tfBtn = tfBar?.querySelector('button.primary');
  const tf = tfBtn ? (tfBtn.dataset.tf || '5m') : '5m';
  const L = Math.max(300, Math.min(+(limitIn?.value || 1200), 5000));

  try{
    const higher=HIGHER_TF[tf]||[];
    const refreshMtf=tf!==lastAnalysisTf || !lastMtfBars.length || Date.now()-lastMtfFetchAt>=60000;
    const settled=await Promise.allSettled([
      fetchBarsFrame(base,tf,L),
      ...(refreshMtf?higher.map(higherTf=>fetchBarsFrame(base,higherTf,80)):[])
    ]);
    if (settled[0].status!=='fulfilled') throw settled[0].reason;
    const primary=settled[0].value;
    const tfChanged=tf!==lastAnalysisTf;
    lastAnalysisTf=tf;
    lastBars=primary.bars;
    lastBarsSource=primary.source;
    if (refreshMtf) {
      lastMtfBars=settled.slice(1)
        .filter(result=>result.status==='fulfilled' && result.value.bars.length>=40)
        .map(result=>result.value);
      lastMtfFetchAt=Date.now();
      settled.slice(1).filter(result=>result.status==='rejected').forEach(result=>logDebug(`MTF: ${result.reason?.message||result.reason}`));
    } else if (tfChanged) {
      lastMtfBars=[];
    }

    ensureCharts();
    setBarsOnCharts(lastBars);

    const closes = lastBars.map(b=>b.c);
    analyzeMarket(lastBars, closes);
    const advice=computeAdvice(lastBars,{
      tf:lastAnalysisTf,
      mtf:lastMtfBars,
      expectedMtf:higher.length,
      live:lastLive,
      barsSource:lastBarsSource,
      enforceMTF:true,
      enforceFresh:true
    });
    applyAdvice(advice);

    refreshFeedStatus();

    if (lastLive && lastLive.price) {
      updatePivot(lastBars, lastLive.price);
    } else {
      updatePivot(lastBars, closes[closes.length-1]);
    }

    const last = lastBars[lastBars.length-1];
    logDebug(`تم جلب ${lastBars.length} شمعة مكتملة (${tf}) + ${lastMtfBars.map(x=>x.tf).join(',')||'بدون MTF'}. آخر إغلاق: ${last.c}`);

    if (advice.side !== lastSignalSide && advice.side !== 'none') {
      lastSignalSide = advice.side;
      showToastSignal(advice);
    }
    if (advice.side==='none') lastSignalSide='none';
  }catch(e){
    logDebug(`فشل جلب الشموع: ${e.message}`);
    lastBars = [];
    applyAdvice({ side:'none', text:'مراقبة فقط', conf:0, entry:null,tp1:null,tp2:null,sl:null, reasons:[] });
  }finally{
    barsRequestRunning = false;
  }
}

// ===== Toast / Flash =====
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

// ===== Telegram Notify =====
async function sendAdviceToTelegram(){
  if (!lastBars || !lastBars.length) return;
  const ad=computeAdvice(lastBars,{tf:lastAnalysisTf,mtf:lastMtfBars,expectedMtf:(HIGHER_TF[lastAnalysisTf]||[]).length,live:lastLive,barsSource:lastBarsSource,enforceMTF:true,enforceFresh:true});
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

// ===== Backtest بسيط =====
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

function saveSignalSettings(){
  const value=el=>el?.value;
  const checked=el=>!!el?.checked;
  const settings={
    mode:chooseMode(),
    autoProfile:checked(autoProfileEl),
    emaOn:checked(emaOnEl),rsiOn:checked(rsiOnEl),macdOn:checked(macdOnEl),stochOn:checked(stochOnEl),bbOn:checked(bbOnEl),
    atrMode:value(atrModeEl),atrPeriod:value(atrPeriodEl),
    bbMode:value(bbModeEl),bbPeriod:value(bbPeriodEl),bbStd:value(bbStdEl),
    emaMode:value(emaModeEl),emaFast:value(emaFastInEl),emaSlow:value(emaSlowInEl),
    rsiMode:value(rsiModeEl),rsiPeriod:value(rsiPeriodEl),
    macdMode:value(macdModeEl),macdFast:value(macdFastEl),macdSlow:value(macdSlowEl),macdSig:value(macdSigEl),
    stochMode:value(stochModeEl),stochK:value(stochKEl),stochD:value(stochDEl),
    nyFilterOn:checked(nyFilterOnEl),nyStart:value(nyStartEl),nyEnd:value(nyEndEl),
    pivotFilterOn:checked(pivotFilterOnEl),pivotDistance:value(pivotDistanceEl)
  };
  try { localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings)); } catch {}
}

function restoreSignalSettings(){
  let settings=null;
  try { settings=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'null'); } catch {}
  if (!settings||typeof settings!=='object') return;
  const setValue=(el,key)=>{ if(el&&settings[key]!=null) el.value=String(settings[key]); };
  const setChecked=(el,key)=>{ if(el&&typeof settings[key]==='boolean') el.checked=settings[key]; };
  if (settings.mode==='safe'&&modeSafeEl) modeSafeEl.checked=true;
  else if (settings.mode==='fast'&&modeFastEl) modeFastEl.checked=true;
  else if (modeSmartEl) modeSmartEl.checked=true;
  ['autoProfile','emaOn','rsiOn','macdOn','stochOn','bbOn','nyFilterOn','pivotFilterOn']
    .forEach(key=>setChecked({autoProfile:autoProfileEl,emaOn:emaOnEl,rsiOn:rsiOnEl,macdOn:macdOnEl,stochOn:stochOnEl,bbOn:bbOnEl,nyFilterOn:nyFilterOnEl,pivotFilterOn:pivotFilterOnEl}[key],key));
  const values={atrMode:atrModeEl,atrPeriod:atrPeriodEl,bbMode:bbModeEl,bbPeriod:bbPeriodEl,bbStd:bbStdEl,
    emaMode:emaModeEl,emaFast:emaFastInEl,emaSlow:emaSlowInEl,rsiMode:rsiModeEl,rsiPeriod:rsiPeriodEl,
    macdMode:macdModeEl,macdFast:macdFastEl,macdSlow:macdSlowEl,macdSig:macdSigEl,
    stochMode:stochModeEl,stochK:stochKEl,stochD:stochDEl,nyStart:nyStartEl,nyEnd:nyEndEl,pivotDistance:pivotDistanceEl};
  Object.entries(values).forEach(([key,el])=>setValue(el,key));
}

function recalculateCurrentAdvice(){
  if (!lastBars||!lastBars.length) return;
  analyzeMarket(lastBars,lastBars.map(b=>b.c));
  const ad=computeAdvice(lastBars,{tf:lastAnalysisTf,mtf:lastMtfBars,expectedMtf:(HIGHER_TF[lastAnalysisTf]||[]).length,live:lastLive,barsSource:lastBarsSource,enforceMTF:true,enforceFresh:true});
  applyAdvice(ad);
  updatePivot(lastBars,lastLive?.price||lastBars.at(-1)?.c);
}

// ===== ربط الـ UI =====
function setupUI(){
  if (saveBase) saveBase.addEventListener('click', ()=>{
    setBase(baseIn.value);
    stopLiveStream();
    connectLiveStream();
    fetchPriceOnce();
  });
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
    recalculateCurrentAdvice();
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

  [modeSmartEl,modeFastEl,modeSafeEl].filter(Boolean).forEach(el=>el.addEventListener('change',()=>{
    if (!el.checked) return;
    applyModeProfile(lastMarketState);
    saveSignalSettings();
    recalculateCurrentAdvice();
  }));

  if (autoProfileEl) autoProfileEl.addEventListener('change',()=>{
    applyModeProfile(lastMarketState);
    saveSignalSettings();
    recalculateCurrentAdvice();
  });

  [emaOnEl,rsiOnEl,macdOnEl,stochOnEl,bbOnEl].filter(Boolean).forEach(el=>el.addEventListener('change',()=>{
    if (!applyingModeProfile&&autoProfileEl?.checked) autoProfileEl.checked=false;
    applyModeProfile(lastMarketState);
    saveSignalSettings();
    recalculateCurrentAdvice();
  }));

  const savedFields=[atrModeEl,atrPeriodEl,bbModeEl,bbPeriodEl,bbStdEl,emaModeEl,emaFastInEl,emaSlowInEl,
    rsiModeEl,rsiPeriodEl,macdModeEl,macdFastEl,macdSlowEl,macdSigEl,stochModeEl,stochKEl,stochDEl,
    nyFilterOnEl,nyStartEl,nyEndEl,pivotFilterOnEl,pivotDistanceEl];
  savedFields.filter(Boolean).forEach(el=>el.addEventListener('change',()=>{
    saveSignalSettings();
    recalculateCurrentAdvice();
  }));
}

// ===== Bootstrap =====
document.addEventListener('DOMContentLoaded', ()=>{
  setBase(getBase());
  restoreSignalSettings();
  setupUI();
  applyModeProfile(lastMarketState);
  ensureCharts();
  startPriceLoop();
  fetchBarsAndUpdate();
  // Refresh only completed candles; live movement is shown by the blue price line.
  setInterval(fetchBarsAndUpdate, 15000);
});
