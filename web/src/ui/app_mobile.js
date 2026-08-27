// app_mobile.js — GoldSignalsX • Advanced v10
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

// إظهار المؤشرات على الشارت (مستقل عن إدراجها في حساب النصيحة)
const showBBEl    = $('#showBB');
const showMacdEl  = $('#showMacd');
const showRsiEl   = $('#showRsi');
const showStochEl = $('#showStoch');

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
const feedConnectionEl = $('#feedConnection');
const feedAgeEl     = $('#feedAge');
const marketAgeEl   = $('#marketAge');
const feedSpreadEl  = $('#feedSpread');

// تبويب النصيحة
const adviceTextEl = $('#adviceText');
const confValEl    = $('#confVal');
const bullScoreValEl = $('#bullScoreVal');
const bearScoreValEl = $('#bearScoreVal');
const mtfValEl       = $('#mtfVal');
const signalStatusEl = $('#signalStatus');
const signalAgeEl    = $('#signalAge');
const signalProgressEl = $('#signalProgress');
const telegramStatusEl = $('#telegramStatus');
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
const btSpreadEl  = $('#btSpread');
const btSlippageEl = $('#btSlippage');
const btTradesEl  = $('#btTrades');
const btPLEl      = $('#btPL');
const btWinEl     = $('#btWin');
const btDDEl      = $('#btDD');
const btPFEl      = $('#btPF');
const btAvgREl    = $('#btAvgR');
const btOosEl     = $('#btOos');
const btAmbiguousEl = $('#btAmbiguous');
const btSummaryEl = $('#btSummary');
const btTableBody = $('#btTable tbody');

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
const newsInfluenceOnEl = $('#newsInfluenceOn');

// ================== حالة عامة ==================

const DEFAULT_BASE = 'https://GoldSignalsX-worker.samer-mourtada.workers.dev';

let lastBars = [];
let lastLive = null;   // {price, bid, ask, spread, ts, receivedAt, source, transport}
let lastReference = null;
let lastBarsSource = '';
let lastBarsStorage = '';
let lastBarsQuality = { ok:false, gaps:0, duplicates:0, reason:'لم تُفحص الشموع بعد' };
let lastAnalysisTf = '1m';
let lastMtfBars = []; // [{ tf, bars, source }]
let lastMtfFetchAt = 0;
let lastAdvice = null;
let activeSignal = null;
let chart, candleSeries, mainChartWrap;
let bbUpperSeries, bbMiddleSeries, bbLowerSeries;
let livePriceLine = null;
const tradePriceLines = { entry:null, tp1:null, tp2:null, sl:null };
let rsiChart, rsiSeries, rsiChartWrap;
let macdChart, macdSeries, macdChartWrap;
let stochChart, stochSeries, stochChartWrap;

let lastSignalSide = 'none'; // 'buy' | 'sell' | 'none'
let barsRequestRunning = false;
let priceRequestRunning = false;
let liveSocket = null;
let liveSocketBase = '';
let liveSocketRetryId = null;
let lastStreamTickAt = 0;
let streamRetryAttempt = 0;
let liveStreamEnabled = true;
let referenceMismatchCount = 0;
let feedIntegrityBlocked = false;
let feedIntegrityReason = '';
let lastMarketState = 'رانج';
let applyingModeProfile = false;

const SETTINGS_KEY = 'GSX_SIGNAL_SETTINGS_V2';
const CHART_DISPLAY_KEY = 'GSX_CHART_DISPLAY_V1';
const ACTIVE_SIGNAL_KEY = 'GSX_ACTIVE_SIGNAL_V1';
const STREAM_STALE_MS = 15000;
const QUOTE_RECEIPT_MAX_AGE_MS = 20000;
const PROVIDER_MAX_AGE_MS = 90000;
const REFERENCE_CHECK_MS = 60000;

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

function newsContextForAdvice() {
  if (!newsInfluenceOnEl?.checked || typeof window === 'undefined') return null;
  const news = window.GSXNewsState;
  const updatedAt = Number(news?.updatedAt);
  if (!news?.ok || news?.stale || !Number.isFinite(updatedAt) || Date.now() - updatedAt > 60 * 60 * 1000) return null;
  return news;
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
  if (!lastLive) {
    if (feedConnectionEl) {
      feedConnectionEl.textContent = 'منقطع';
      feedConnectionEl.style.color = 'var(--bad)';
    }
    return;
  }
  const age = Math.max(0, Date.now() - Number(lastLive.receivedAt || lastLive.ts));
  const providerAge = Math.max(0, Date.now() - Number(lastLive.ts));
  if (feedAgeEl) {
    feedAgeEl.textContent = formatAge(age);
    feedAgeEl.style.color = age <= 5000 ? 'var(--ok)' : age <= QUOTE_RECEIPT_MAX_AGE_MS ? 'var(--accent)' : 'var(--bad)';
  }
  if (marketAgeEl) {
    marketAgeEl.textContent = formatAge(providerAge);
    marketAgeEl.style.color = providerAge <= 60000 ? 'var(--ok)' : providerAge <= PROVIDER_MAX_AGE_MS ? 'var(--accent)' : 'var(--bad)';
  }
  if (feedSourceEl) {
    const liveSource = lastLive.source || '—';
    const sameSource = !lastBarsSource || lastBarsSource === liveSource;
    const storage = lastBarsStorage ? ` • ${lastBarsStorage.toUpperCase()}` : '';
    feedSourceEl.textContent = sameSource ? `${liveSource}${storage}` : `${liveSource} / شموع ${lastBarsSource}${storage}`;
    feedSourceEl.style.color = sameSource ? 'var(--ok)' : 'var(--accent)';
  }
  if (feedSpreadEl) feedSpreadEl.textContent = Number.isFinite(lastLive.spread) ? lastLive.spread.toFixed(3) : '—';
  if (feedConnectionEl) {
    let text='احتياطي', color='var(--accent)';
    if (age>QUOTE_RECEIPT_MAX_AGE_MS){ text='متأخر'; color='var(--bad)'; }
    else if (providerAge>PROVIDER_MAX_AGE_MS){ text='سوق متأخر'; color='var(--bad)'; }
    else if (feedIntegrityBlocked){ text='اختلاف أسعار'; color='var(--bad)'; }
    else if (lastLive.transport==='stream'){ text='مباشر'; color='var(--ok)'; }
    feedConnectionEl.textContent=text;
    feedConnectionEl.style.color=color;
    feedConnectionEl.title=feedIntegrityReason || '';
  }
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
  const out=Array(closes.length).fill(null);
  if (closes.length <= period) return out;
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
  const rsiValue=()=>avgLoss===0?(avgGain===0?50:100):100-100/(1+avgGain/avgLoss);
  out[period]=rsiValue();
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    out[i+1]=rsiValue();
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
  if (context.enforceFresh && context.dataQuality?.ok===false) {
    return empty('مراقبة فقط',[context.dataQuality.reason || 'جودة الشموع غير سليمة؛ تم منع الإشارة احتياطياً.']);
  }

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
    const quoteReceivedAt=Number(context.live?.receivedAt || quoteTs);
    const quotePrice=Number(context.live?.price);
    const providerAge=Date.now()-quoteTs;
    const receiptAge=Date.now()-quoteReceivedAt;
    if (!Number.isFinite(quoteTs) || !Number.isFinite(quoteReceivedAt) || !Number.isFinite(quotePrice) ||
        receiptAge<0 || receiptAge>QUOTE_RECEIPT_MAX_AGE_MS) {
      return empty('مراقبة فقط',['وصول السعر الحي متوقف أو أقدم من 20 ثانية؛ تم منع الإشارة.']);
    }
    if (providerAge < -30000 || providerAge>PROVIDER_MAX_AGE_MS) {
      return empty('مراقبة فقط',['توقيت سعر السوق متأخر أكثر من 90 ثانية؛ تم منع الإشارة.']);
    }
    if (context.feedIntegrityBlocked) {
      return empty('مراقبة فقط',[context.feedIntegrityReason || 'يوجد اختلاف متكرر بين مصدري السعر؛ تم منع الإشارة.']);
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

  let newsBlocked=false;
  const news=context.news;
  if (news?.ok && !news?.stale) {
    if (news.safety?.blockTechnicalSignal) {
      newsBlocked=true;
      neutralReasons.unshift(news.safety.reason || 'خبر شديد التأثير؛ تم إيقاف الدخول مؤقتاً حتى يهدأ تذبذب السوق');
    }
    const direction=news.goldBias?.direction;
    const confidence=Math.max(0,Math.min(100,Number(news.goldBias?.confidence)||0));
    const weight=Math.min(0.9,Math.max(0,(confidence-50)/40*0.9));
    if (direction==='bullish'&&weight>0) {
      bullScore+=weight;
      bullReasons.push(`الأخبار داعمة للذهب بوزن محدود (${confidence.toFixed(0)}%)`);
    } else if (direction==='bearish'&&weight>0) {
      bearScore+=weight;
      bearReasons.push(`الأخبار ضاغطة على الذهب بوزن محدود (${confidence.toFixed(0)}%)`);
    } else {
      neutralReasons.push('الميل الإخباري محايد؛ لا يغيّر القرار الفني');
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

  let side=(leaderScore>=threshold && margin>=2 && candleConfirmed && confirmations>=requiredMtf && !(oppositions>confirmations && mtfAvailable) && !nyBlocked && !pivotBlocked && !newsBlocked)?leader:'none';
  const liveSource=context.live?.source||'';
  const barsSource=context.barsSource||'';
  const livePrice=Number(context.live?.price);
  const liveAge=Date.now()-Number(context.live?.receivedAt||context.live?.ts||0);
  const priceGap=Number.isFinite(livePrice)?Math.abs(livePrice-C):Infinity;
  const priceAligned=priceGap<=Math.max(atr*0.75,C*0.002);
  const storedBars=context.barsStorage==='d1'||barsSource==='d1'||barsSource==='kv';
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
    tf,
    signalBarTs:Number(last?.t)||Date.now(),
    bullScore,bearScore,
    mtf:{bull:mtfBull,bear:mtfBear,neutral:mtfNeutral}
  };
}

function isTerminalSignalStatus(status){
  return ['tp2','stopped','expired','cancelled'].includes(status);
}

function signalExpiryMs(tf){
  const base=TF_MS[tf]||300000;
  return Math.min(7*24*60*60*1000,Math.max(30*60*1000,base*12));
}

function validSignal(signal){
  if (!signal || !['buy','sell'].includes(signal.side)) return false;
  return ['entry','tp1','tp2','sl','createdAt'].every(key=>Number.isFinite(Number(signal[key]))) &&
    Number(signal.createdAt)>0;
}

function persistActiveSignal(){
  try{
    if (activeSignal) localStorage.setItem(ACTIVE_SIGNAL_KEY,JSON.stringify(activeSignal));
    else localStorage.removeItem(ACTIVE_SIGNAL_KEY);
  }catch{}
}

function restoreActiveSignal(){
  try{
    const saved=JSON.parse(localStorage.getItem(ACTIVE_SIGNAL_KEY)||'null');
    if (!validSignal(saved)) return;
    const serverId=/^(1m|5m|15m|30m|60m|240m|1d):\d+:(buy|sell)$/.test(String(saved.id||''));
    if (saved.origin!=='server'&&!serverId) {
      localStorage.removeItem(ACTIVE_SIGNAL_KEY);
      return;
    }
    activeSignal={...saved,origin:'server'};
    if (!isTerminalSignalStatus(activeSignal.status) && Date.now()-activeSignal.createdAt>signalExpiryMs(activeSignal.tf)) {
      activeSignal.status='expired';
      activeSignal.closedAt=Date.now();
      activeSignal.closedBarTs=Number(lastBars.at(-1)?.t)||Number(activeSignal.signalBarTs)||0;
      persistActiveSignal();
    }
  }catch{}
}

function signalFromAdvice(ad){
  const createdAt=Date.now();
  return {
    id:`${createdAt}-${ad.side}`,
    side:ad.side,
    entry:Number(ad.entry),tp1:Number(ad.tp1),tp2:Number(ad.tp2),sl:Number(ad.sl),
    conf:Number(ad.conf)||0,
    reasons:Array.isArray(ad.reasons)?ad.reasons.slice(0,8):[],
    pattern:ad.pattern||'لا يوجد نمط واضح',
    bullScore:Number(ad.bullScore),bearScore:Number(ad.bearScore),
    mtf:ad.mtf||{bull:0,bear:0,neutral:0},
    tf:ad.tf||lastAnalysisTf,
    signalBarTs:Number(ad.signalBarTs)||Number(lastBars.at(-1)?.t)||createdAt,
    createdAt,
    status:'active',
    tp1Hit:false,
    lastPrice:Number(ad.entry)
  };
}

function signalStatusText(signal){
  if (!signal) return 'لا توجد';
  const side=signal.side==='buy'?'شراء':'بيع';
  if (signal.status==='tp1') return `${side} فعّال • تحقق TP1`;
  if (signal.status==='tp2') return `${side} مكتمل • تحقق TP2`;
  if (signal.status==='stopped') return `${side} منتهٍ • SL`;
  if (signal.status==='expired') return `${side} منتهي الصلاحية`;
  if (signal.status==='cancelled') return `${side} مُلغى`;
  return `${side} فعّال`;
}

function signalAsAdvice(signal){
  if (!signal) return null;
  return {
    side:signal.side,
    text:signalStatusText(signal),
    conf:signal.conf,
    entry:signal.entry,tp1:signal.tp1,tp2:signal.tp2,sl:signal.sl,
    reasons:signal.reasons,pattern:signal.pattern,
    bullScore:signal.bullScore,bearScore:signal.bearScore,mtf:signal.mtf,
    tf:signal.tf,signalBarTs:signal.signalBarTs,status:signal.status,
    createdAt:signal.createdAt,lastPrice:signal.lastPrice
  };
}

function reconcileAdviceSignal(ad){
  const actionable=ad && ['buy','sell'].includes(ad.side) &&
    [ad.entry,ad.tp1,ad.tp2,ad.sl].every(value=>Number.isFinite(Number(value)));
  if (!actionable) return {ad:activeSignal?signalAsAdvice(activeSignal):ad,isNew:false};

  const rawBarTs=Number(ad.signalBarTs)||Number(lastBars.at(-1)?.t)||Date.now();
  if (activeSignal && !isTerminalSignalStatus(activeSignal.status)) {
    if (activeSignal.side===ad.side) return {ad:signalAsAdvice(activeSignal),isNew:false};
    activeSignal.status='cancelled';
    activeSignal.closedAt=Date.now();
    activeSignal.closedBarTs=Number(lastBars.at(-1)?.t)||rawBarTs;
    activeSignal=signalFromAdvice(ad);
    persistActiveSignal();
    return {ad:signalAsAdvice(activeSignal),isNew:true};
  }

  if (activeSignal && isTerminalSignalStatus(activeSignal.status) && rawBarTs<=Number(activeSignal.closedBarTs||0)) {
    return {ad:signalAsAdvice(activeSignal),isNew:false};
  }

  activeSignal=signalFromAdvice(ad);
  persistActiveSignal();
  return {ad:signalAsAdvice(activeSignal),isNew:true};
}

function signalProgressR(signal,price){
  if (!signal || !Number.isFinite(price)) return NaN;
  const risk=Math.abs(signal.entry-signal.sl);
  if (!Number.isFinite(risk)||risk<=0) return NaN;
  return signal.side==='buy'?(price-signal.entry)/risk:(signal.entry-price)/risk;
}

function renderSignalMeta(signal){
  if (signalStatusEl) {
    signalStatusEl.textContent=signalStatusText(signal);
    signalStatusEl.style.color=!signal?'var(--muted)':signal.status==='stopped'?'var(--bad)':isTerminalSignalStatus(signal.status)?'var(--accent)':'var(--ok)';
  }
  if (signalAgeEl) signalAgeEl.textContent=signal?formatAge(Date.now()-signal.createdAt):'—';
  if (signalProgressEl) {
    const progress=signalProgressR(signal,Number(signal?.lastPrice));
    signalProgressEl.textContent=Number.isFinite(progress)?`${progress>=0?'+':''}${progress.toFixed(2)}R`:'—';
    signalProgressEl.style.color=Number.isFinite(progress)?(progress>=0?'var(--ok)':'var(--bad)'):'var(--muted)';
  }
  if (telegramStatusEl) {
    const delivery=signal?.telegram;
    telegramStatusEl.textContent=!signal?'—':delivery?.status==='sent'?'تم الإرسال':delivery?.status==='pending'?'بانتظار الإرسال':delivery?.status==='failed'?'فشل الإرسال':'لم يُرسل بعد';
    telegramStatusEl.style.color=delivery?.status==='sent'?'var(--ok)':delivery?.status==='failed'?'var(--bad)':delivery?.status==='pending'?'var(--accent)':'var(--muted)';
  }
}

function updateSignalMarker(ad){
  if (!candleSeries || typeof candleSeries.setMarkers!=='function') return;
  if (!ad || !['buy','sell'].includes(ad.side) || !Number.isFinite(Number(ad.signalBarTs))) {
    candleSeries.setMarkers([]);
    return;
  }
  const terminal=isTerminalSignalStatus(ad.status);
  const statusLabel=ad.status==='tp2'?'TP2':ad.status==='stopped'?'SL':ad.status==='expired'?'EXP':ad.side==='buy'?'BUY':'SELL';
  candleSeries.setMarkers([{
    time:Math.floor(Number(ad.signalBarTs)/1000),
    position:ad.side==='buy'?'belowBar':'aboveBar',
    color:terminal?(ad.status==='stopped'?'#ef4444':'#f59e0b'):(ad.side==='buy'?'#22c55e':'#ef4444'),
    shape:ad.side==='buy'?'arrowUp':'arrowDown',
    text:`${statusLabel} ${Number(ad.conf||0).toFixed(0)}%`
  }]);
}

function renderAdvice(ad){
  lastAdvice=ad;
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
  updateSignalMarker(ad);
  renderSignalMeta(activeSignal);
  if (btnNotify) {
    const canNotify=Boolean(activeSignal && !isTerminalSignalStatus(activeSignal.status));
    btnNotify.disabled=!canNotify;
    btnNotify.title=canNotify?'إرسال الإشارة الحالية':'لا توجد إشارة فعلية قابلة للإرسال';
  }
}

function applyAdvice(ad,{authoritative=false,isNew=false}={}) {
  if (authoritative) {
    renderAdvice(ad);
    return {ad,isNew};
  }
  const reconciled=reconcileAdviceSignal(ad);
  renderAdvice(reconciled.ad);
  return reconciled;
}

function updateSignalLifecycle(price,ts=Date.now()){
  if (!activeSignal || isTerminalSignalStatus(activeSignal.status) || !Number.isFinite(Number(price))) {
    renderSignalMeta(activeSignal);
    return;
  }
  const p=Number(price);
  activeSignal.lastPrice=p;
  if (activeSignal.origin==='server') {
    renderSignalMeta(activeSignal);
    return;
  }
  let nextStatus=activeSignal.status;
  if (Date.now()-activeSignal.createdAt>signalExpiryMs(activeSignal.tf)) nextStatus='expired';
  else if (activeSignal.side==='buy') {
    if (p<=activeSignal.sl) nextStatus='stopped';
    else if (p>=activeSignal.tp2) nextStatus='tp2';
    else if (p>=activeSignal.tp1) nextStatus='tp1';
  } else {
    if (p>=activeSignal.sl) nextStatus='stopped';
    else if (p<=activeSignal.tp2) nextStatus='tp2';
    else if (p<=activeSignal.tp1) nextStatus='tp1';
  }
  if (nextStatus==='tp1') activeSignal.tp1Hit=true;
  if (nextStatus!==activeSignal.status) {
    activeSignal.status=nextStatus;
    if (isTerminalSignalStatus(nextStatus)) {
      activeSignal.closedAt=Number(ts)||Date.now();
      activeSignal.closedBarTs=Number(lastBars.at(-1)?.t)||Number(activeSignal.signalBarTs)||0;
    }
    persistActiveSignal();
    logDebug(`حالة الإشارة: ${signalStatusText(activeSignal)} عند ${p.toFixed(3)}`);
  }
  renderAdvice(signalAsAdvice(activeSignal));
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
  mainChartWrap = wrap;
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
    downColor:'#ef4444', borderDownColor:'#ef4444', wickDownColor:'#ef4444',
    // The candle series' built-in last-price line looks like a TP line.
    // Keep only our explicit blue Live line and actual trade levels.
    priceLineVisible:false,
    lastValueVisible:false
  });

  const bbSeriesOptions = {
    lineWidth:1,
    priceLineVisible:false,
    lastValueVisible:false,
    crosshairMarkerVisible:false
  };
  bbUpperSeries = chart.addLineSeries({ ...bbSeriesOptions, color:'#60a5fa' });
  bbMiddleSeries = chart.addLineSeries({ ...bbSeriesOptions, color:'#f59e0b' });
  bbLowerSeries = chart.addLineSeries({ ...bbSeriesOptions, color:'#60a5fa' });

  const rsiP = $('#rsiPanel');
  if (rsiP){
    const w = document.createElement('div');
    rsiChartWrap = w;
    w.style.width='100%';
    const rRect = rsiP.getBoundingClientRect();
    const rh = (rRect.height && rRect.height>0) ? rRect.height : 120;
    w.style.height = rh + 'px';
    rsiP.replaceWith(w);
    rsiChart = LightweightCharts.createChart(w, {
      layout:{ background:{type:'solid', color:getComputedStyle(document.documentElement).getPropertyValue('--card2').trim()||'#0b0f17'}, textColor:getComputedStyle(document.documentElement).getPropertyValue('--fg').trim()||'#e5e7eb'},
      timeScale:{}
    });
    rsiSeries = rsiChart.addLineSeries({
      color:'#3b82f6',lineWidth:2,priceLineVisible:false,lastValueVisible:true,
      autoscaleInfoProvider:()=>({priceRange:{minValue:0,maxValue:100}})
    });
    [
      {price:70,color:'#ef4444',title:'70'},
      {price:50,color:'#64748b',title:'50'},
      {price:30,color:'#22c55e',title:'30'}
    ].forEach(level=>rsiSeries.createPriceLine({
      ...level,lineWidth:1,lineStyle:LightweightCharts.LineStyle.Dashed,axisLabelVisible:true
    }));
  }

  const macdP = $('#macdPanel');
  if (macdP){
    const w = document.createElement('div');
    macdChartWrap = w;
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
    stochChartWrap = w;
    w.style.width='100%';
    const sRect = stochP.getBoundingClientRect();
    const sh = (sRect.height && sRect.height>0) ? sRect.height : 120;
    w.style.height = sh + 'px';
    stochP.replaceWith(w);
    stochChart = LightweightCharts.createChart(w, {
      layout:{ background:{type:'solid', color:getComputedStyle(document.documentElement).getPropertyValue('--card2').trim()||'#0b0f17'}, textColor:getComputedStyle(document.documentElement).getPropertyValue('--fg').trim()||'#e5e7eb'},
      timeScale:{}
    });
    stochSeries = stochChart.addLineSeries({
      color:'#3b82f6',lineWidth:2,priceLineVisible:false,lastValueVisible:true,
      autoscaleInfoProvider:()=>({priceRange:{minValue:0,maxValue:100}})
    });
    [
      {price:80,color:'#ef4444',title:'80'},
      {price:50,color:'#64748b',title:'50'},
      {price:20,color:'#22c55e',title:'20'}
    ].forEach(level=>stochSeries.createPriceLine({
      ...level,lineWidth:1,lineStyle:LightweightCharts.LineStyle.Dashed,axisLabelVisible:true
    }));
  }

  window.addEventListener('resize', resizeChartsToContainers);

  applyChartDisplay();
  updateLivePriceLine();
  updateTradePriceLines(lastAdvice);
}

function resizeChartToContainer(chartInstance, container){
  if (!chartInstance || !container || container.style.display==='none') return;
  const rect=container.getBoundingClientRect();
  if (rect.width>0 && rect.height>0) chartInstance.applyOptions({width:rect.width,height:rect.height});
}

function resizeChartsToContainers(){
  resizeChartToContainer(chart,mainChartWrap);
  resizeChartToContainer(macdChart,macdChartWrap);
  resizeChartToContainer(rsiChart,rsiChartWrap);
  resizeChartToContainer(stochChart,stochChartWrap);
}

function applyChartDisplay(){
  const bbVisible=showBBEl ? showBBEl.checked : true;
  [bbUpperSeries,bbMiddleSeries,bbLowerSeries].filter(Boolean)
    .forEach(series=>series.applyOptions({visible:bbVisible}));

  const panels=[
    [macdChartWrap,macdChart,showMacdEl ? showMacdEl.checked : true],
    [rsiChartWrap,rsiChart,showRsiEl ? showRsiEl.checked : true],
    [stochChartWrap,stochChart,showStochEl ? showStochEl.checked : false]
  ];
  panels.forEach(([container,chartInstance,visible])=>{
    if (!container) return;
    container.style.display=visible?'block':'none';
    if (visible) requestAnimationFrame(()=>resizeChartToContainer(chartInstance,container));
  });
}

function saveChartDisplaySettings(){
  const settings={
    bb:!!showBBEl?.checked,
    macd:!!showMacdEl?.checked,
    rsi:!!showRsiEl?.checked,
    stoch:!!showStochEl?.checked
  };
  try { localStorage.setItem(CHART_DISPLAY_KEY,JSON.stringify(settings)); } catch {}
}

function restoreChartDisplaySettings(){
  let settings=null;
  try { settings=JSON.parse(localStorage.getItem(CHART_DISPLAY_KEY)||'null'); } catch {}
  if (!settings || typeof settings!=='object') return;
  [[showBBEl,'bb'],[showMacdEl,'macd'],[showRsiEl,'rsi'],[showStochEl,'stoch']].forEach(([el,key])=>{
    if (el && typeof settings[key]==='boolean') el.checked=settings[key];
  });
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
  const active = ad && (ad.side === 'buy' || ad.side === 'sell') && !isTerminalSignalStatus(ad.status);
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
  const bbObj=calcBB(closes,+(bbPeriodEl?.value||20),+(bbStdEl?.value||2));
  const lineData=values=>bars.map((b,i)=>({time:Math.floor(b.t/1000),value:values[i]}))
    .filter(point=>Number.isFinite(point.value));
  if (bbUpperSeries) bbUpperSeries.setData(lineData(bbObj.upper));
  if (bbMiddleSeries) bbMiddleSeries.setData(lineData(bbObj.ma));
  if (bbLowerSeries) bbLowerSeries.setData(lineData(bbObj.lower));

  const rsiArr = calcRSI(closes, +(rsiPeriodEl?.value||14));
  if (rsiSeries){
    const d = bars.map((b,i)=>({time:Math.floor(b.t/1000),value:rsiArr[i]}))
      .filter(point=>Number.isFinite(point.value));
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
    const d = bars.map((b,i)=>({time:Math.floor(b.t/1000),value:stArr[i]}))
      .filter(point=>Number.isFinite(point.value));
    stochSeries.setData(d);
    stochChart.timeScale().setVisibleLogicalRange({ from: Math.max(0, d.length - 100), to: d.length + 5 });
  }
  applyChartDisplay();
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
    receivedAt:Date.now(),
    transport:'stream',
    source:payload.source || 'twelve-data'
  };
}

function applyLiveQuote(quote){
  if (!quote || !Number.isFinite(quote.price)) return false;
  const receivedAt=Number(quote.receivedAt)||Date.now();
  lastLive={
    price:Number(quote.price),
    bid:Number(quote.bid),
    ask:Number(quote.ask),
    spread:Number(quote.spread),
    ts:Number(quote.ts || Date.now()),
    receivedAt,
    transport:quote.transport || 'rest',
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
  updateSignalLifecycle(lastLive.price,lastLive.receivedAt);
  return true;
}

function compareReferenceQuote(reference){
  lastReference=reference;
  if (!lastLive || lastLive.transport!=='stream') return;
  const streamAge=Date.now()-Number(lastLive.receivedAt||0);
  if (streamAge>STREAM_STALE_MS) return;
  const gap=Math.abs(Number(reference.price)-Number(lastLive.price));
  const tolerance=Math.max(5,Math.abs(Number(lastLive.price))*0.004);
  if (Number.isFinite(gap) && gap>tolerance) {
    referenceMismatchCount+=1;
    if (referenceMismatchCount>=2) {
      feedIntegrityBlocked=true;
      feedIntegrityReason=`فرق متكرر ${gap.toFixed(2)}$ بين ${lastLive.source} و${reference.source}`;
      logDebug(`${feedIntegrityReason}؛ تم منع الإشارات مؤقتاً`);
    }
  } else if (Number.isFinite(gap)) {
    referenceMismatchCount=0;
    feedIntegrityBlocked=false;
    feedIntegrityReason='';
  }
  refreshFeedStatus();
}

async function fetchPriceOnce({ referenceOnly=false }={}){
  if (priceRequestRunning) return;
  priceRequestRunning=true;
  const base = getBase();
  try{
    const r = await fetch(`${base}/price`, { cache:'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (!j.ok || !Number.isFinite(j.price)) throw new Error('رد /price غير صالح');
    const ts=j.ts || Date.now();
    const quote={
      price:Number(j.price),
      bid:Number(j.bid),
      ask:Number(j.ask),
      spread:Number(j.spread),
      ts:Number(ts),
      receivedAt:Date.now(),
      transport:'rest',
      source:j.source || 'worker'
    };
    if (referenceOnly && lastLive?.transport==='stream' && Date.now()-Number(lastLive.receivedAt||0)<=STREAM_STALE_MS) {
      compareReferenceQuote(quote);
    } else {
      applyLiveQuote(quote);
    }

    logDebug(`سعر حي: ${j.price} من ${j.source || '؟'}${Number.isFinite(j.spread) ? ` • spread ${Number(j.spread).toFixed(3)}` : ''}`);
  }catch(e){
    logDebug(`فشل جلب السعر الحي: ${e.message}`);
    const currentAge=lastLive ? Date.now()-Number(lastLive.receivedAt||lastLive.ts||0) : Infinity;
    if (feedAgeEl && currentAge>QUOTE_RECEIPT_MAX_AGE_MS) {
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
  if (!liveStreamEnabled || document.hidden || liveSocketRetryId) return;
  const delays=[3000,5000,10000,20000,30000];
  const delay=delays[Math.min(streamRetryAttempt,delays.length-1)];
  streamRetryAttempt+=1;
  liveSocketRetryId=setTimeout(()=>{
    liveSocketRetryId=null;
    connectLiveStream();
  },delay);
}

function connectLiveStream(){
  if (typeof WebSocket==='undefined' || document.hidden) return;
  liveStreamEnabled=true;
  const base=getBase();
  if (liveSocket && liveSocketBase===base && liveSocket.readyState<2) return;
  stopLiveStream();
  liveSocketBase=base;
  const wsUrl=`${base.replace(/^http/i,'ws')}/stream`;

  try{
    const socket=new WebSocket(wsUrl);
    liveSocket=socket;
    socket.addEventListener('open',()=>{
      streamRetryAttempt=0;
      logDebug('اتصل البث الحي Twelve Data');
      refreshFeedStatus();
    });
    socket.addEventListener('message',(event)=>{
      let payload;
      try{ payload=JSON.parse(event.data); }catch{ return; }
      const quote=normalizeStreamQuote(payload);
      if (quote && applyLiveQuote(quote)){
        lastStreamTickAt=Date.now();
        streamRetryAttempt=0;
        logDebug(`سعر لحظي: ${quote.price} من ${quote.source}`);
        return;
      }
      if (payload?.event==='error' || payload?.status==='error'){
        logDebug(`بث Twelve Data: ${payload.message || payload.code || 'غير متاح'}`);
      }
    });
    socket.addEventListener('close',()=>{
      const wasCurrent=liveSocket===socket;
      if (wasCurrent) liveSocket=null;
      if (wasCurrent) scheduleStreamReconnect();
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
    if (!lastStreamTickAt || Date.now()-lastStreamTickAt>STREAM_STALE_MS) fetchPriceOnce();
  },3000);
  setInterval(()=>fetchPriceOnce({referenceOnly:true}),REFERENCE_CHECK_MS);
  setInterval(()=>{
    if (document.hidden) return;
    const streamAge=lastStreamTickAt ? Date.now()-lastStreamTickAt : Infinity;
    if (liveSocket?.readyState===WebSocket.OPEN && streamAge>STREAM_STALE_MS) {
      const socket=liveSocket;
      liveSocket=null;
      try{ socket.close(1012,'stale stream'); }catch{}
      logDebug('البث متصل بلا أسعار حديثة؛ تشغيل الاحتياط وإعادة الاتصال');
      scheduleStreamReconnect();
    }
  },1000);
  setInterval(refreshFeedStatus, 1000);
}

// ===== جلب الشموع من /bars =====
function newYorkClockParts(ts) {
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false
  }).formatToParts(new Date(ts));
  const get=type=>parts.find(part=>part.type===type)?.value||'';
  return { weekday:get('weekday'), minute:Number(get('hour'))%24*60+Number(get('minute')) };
}

function isExpectedMarketClosure(previousTs,nextTs,duration) {
  const gap=nextTs-previousTs;
  if (!Number.isFinite(gap) || gap<=duration*1.5) return false;
  if (duration>=86400000 && gap>=2*86400000 && gap<=4*86400000) return true;
  if (gap>=30*60*60*1000 && gap<=80*60*60*1000) {
    const previousDay=newYorkClockParts(previousTs+duration).weekday;
    const nextDay=newYorkClockParts(nextTs).weekday;
    if (previousDay==='Fri' && (nextDay==='Sun'||nextDay==='Mon')) return true;
  }
  if (gap<=Math.max(3*60*60*1000,duration*3)) {
    const previousEnd=newYorkClockParts(previousTs+duration).minute;
    const nextStart=newYorkClockParts(nextTs).minute;
    return previousEnd>=16*60+30 && previousEnd<=17*60+30 &&
      nextStart>=17*60+30 && nextStart<=18*60+30;
  }
  return false;
}

function inspectBarQuality(bars,tf,duplicateTimes=new Set(),invalid=0) {
  const duration=TF_MS[tf]||60000;
  const recent=bars.slice(-Math.min(120,bars.length));
  const recentStart=Number(recent[0]?.t)||Infinity;
  const duplicates=[...duplicateTimes].filter(ts=>ts>=recentStart).length;
  let gaps=0;
  for (let i=1;i<recent.length;i++) {
    const delta=recent[i].t-recent[i-1].t;
    if (delta>duration*1.5 && !isExpectedMarketClosure(recent[i-1].t,recent[i].t,duration)) gaps++;
  }
  const ok=duplicates===0 && gaps===0;
  const reasons=[];
  if (duplicates) reasons.push(`${duplicates} توقيت شمعة مكرر`);
  if (gaps) reasons.push(`${gaps} فجوة غير طبيعية ضمن أحدث الشموع`);
  return {
    ok,gaps,duplicates,invalid,
    reason:ok?'جودة الشموع سليمة':`جودة الشموع غير سليمة: ${reasons.join('، ')}؛ تم منع الإشارة احتياطياً.`
  };
}

function normalizeBarsFrame(rows,tf) {
  const duration=TF_MS[tf]||60000;
  const now=Date.now();
  let invalid=0;
  const mapped=(Array.isArray(rows)?rows:[]).map(b=>{
    const rawT=b.t??b.time??b.ts??b.isoTime??b.date??0;
    let t=typeof rawT==='string'?Date.parse(rawT):Number(rawT);
    if (Number.isFinite(t) && t<1e12) t*=1000;
    const bar={ t,o:+b.o,h:+b.h,l:+b.l,c:+b.c,v:+(b.v||0),complete:b.complete,provider:String(b.provider||'') };
    const valid=Number.isFinite(bar.t) && Number.isFinite(bar.o) && Number.isFinite(bar.h) &&
      Number.isFinite(bar.l) && Number.isFinite(bar.c) && bar.h>=bar.l && bar.complete!==false;
    if (!valid) invalid++;
    return valid?bar:null;
  }).filter(Boolean).sort((a,b)=>a.t-b.t)
    .filter(b=>b.complete===true || b.t+duration<=now+2000);

  const duplicateTimes=new Set();
  const unique=new Map();
  for (const bar of mapped) {
    if (unique.has(bar.t)) duplicateTimes.add(bar.t);
    unique.set(bar.t,bar);
  }
  const bars=[...unique.values()].sort((a,b)=>a.t-b.t);
  return { bars,quality:inspectBarQuality(bars,tf,duplicateTimes,invalid) };
}

function normalizeCompletedBars(rows,tf) {
  return normalizeBarsFrame(rows,tf).bars;
}

async function fetchBarsFrame(base,tf,limit) {
  const url=`${base}/bars?tf=${encodeURIComponent(tf)}&limit=${encodeURIComponent(limit)}`;
  const response=await fetch(url,{cache:'no-store'});
  if (!response.ok) throw new Error(`${tf}: HTTP ${response.status}`);
  const source=response.headers.get('x-gsx-source')||'';
  const storage=response.headers.get('x-gsx-storage')||'';
  const storedGapCount=Number(response.headers.get('x-gsx-gaps'));
  const rows=await response.json();
  const {bars,quality}=normalizeBarsFrame(rows,tf);
  if (!bars.length) throw new Error(`${tf}: لا توجد شموع مكتملة`);
  return {tf,bars,source,storage,quality,storedGapCount:Number.isFinite(storedGapCount)?storedGapCount:null};
}

async function fetchCentralDecision(base,tf) {
  try {
    const response=await fetch(`${base}/signals?tf=${encodeURIComponent(tf)}`,{cache:'no-store'});
    if (!response.ok) return {reachable:false,state:null,evaluation:null};
    const payload=await response.json();
    const row=payload?.signals?.[0]||{};
    return {
      reachable:Boolean(payload?.ok),
      state:validSignal(row.state)?row.state:null,
      evaluation:row.evaluation&&typeof row.evaluation==='object'?row.evaluation:null,
      updatedAt:Number(payload?.updatedAt||0),refreshing:Boolean(payload?.refreshing)
    };
  } catch {
    return {reachable:false,state:null,evaluation:null};
  }
}

function centralEvaluationAdvice(evaluation,localPreview){
  if (!evaluation) return {
    side:'none',text:'مراقبة فقط — بانتظار تقييم الخادم',conf:0,
    entry:null,tp1:null,tp2:null,sl:null,reasons:['لم يصل تقييم مركزي حديث بعد']
  };
  if (['buy','sell'].includes(evaluation.side)) return {
    ...evaluation,side:'none',text:'مراقبة فقط — بانتظار تثبيت الإشارة الرسمية',
    entry:null,tp1:null,tp2:null,sl:null,
    reasons:['الخادم رصد إعداداً أولياً لكنه لم يثبّت صفقة رسمية بعد',...(evaluation.reasons||[])]
  };
  return {
    ...localPreview,...evaluation,side:'none',text:evaluation.text||'مراقبة فقط',
    entry:null,tp1:null,tp2:null,sl:null
  };
}

async function fetchBarsAndUpdate(){
  if (barsRequestRunning) return;
  barsRequestRunning = true;
  const base = getBase();
  const tfBtn = tfBar?.querySelector('button.primary');
  const tf = tfBtn ? (tfBtn.dataset.tf || '5m') : '5m';
  const L = Math.max(300, Math.min(+(limitIn?.value || 1200), 5000));

  try{
    const centralDecisionPromise=fetchCentralDecision(base,tf);
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
    lastBarsStorage=primary.storage;
    lastBarsQuality=primary.quality;
    if (refreshMtf) {
      lastMtfBars=settled.slice(1)
        .filter(result=>result.status==='fulfilled' && result.value.bars.length>=40 && result.value.quality.ok)
        .map(result=>result.value);
      lastMtfFetchAt=Date.now();
      settled.slice(1).filter(result=>result.status==='rejected').forEach(result=>logDebug(`MTF: ${result.reason?.message||result.reason}`));
      settled.slice(1).filter(result=>result.status==='fulfilled' && !result.value.quality.ok)
        .forEach(result=>logDebug(`MTF ${result.value.tf}: ${result.value.quality.reason}`));
    } else if (tfChanged) {
      lastMtfBars=[];
    }

    ensureCharts();
    setBarsOnCharts(lastBars);

    const closes = lastBars.map(b=>b.c);
    analyzeMarket(lastBars, closes);
    let advice=computeAdvice(lastBars,{
      tf:lastAnalysisTf,
      mtf:lastMtfBars,
      expectedMtf:higher.length,
      live:lastLive,
      barsSource:lastBarsSource,
      barsStorage:lastBarsStorage,
      dataQuality:lastBarsQuality,
      feedIntegrityBlocked,
      feedIntegrityReason,
      news:newsContextForAdvice(),
      enforceMTF:true,
      enforceFresh:true
    });
    const central=await centralDecisionPromise;
    let isNew=false;
    if (central.reachable&&central.state) {
      const previousId=activeSignal?.id;
      activeSignal={...central.state,origin:'server'};
      persistActiveSignal();
      advice=signalAsAdvice(activeSignal);
      isNew=Boolean(!isTerminalSignalStatus(activeSignal.status)&&previousId!==activeSignal.id);
    } else if (central.reachable) {
      activeSignal=null;
      persistActiveSignal();
      advice=centralEvaluationAdvice(central.evaluation,advice);
    } else if (activeSignal?.origin==='server'&&validSignal(activeSignal)) {
      advice=signalAsAdvice(activeSignal);
      advice.reasons=['تعذّر تحديث حالة الخادم مؤقتاً؛ المعروض آخر إشارة رسمية محفوظة',...(advice.reasons||[])];
    } else {
      activeSignal=null;
      persistActiveSignal();
      advice={
        ...advice,side:'none',text:'مراقبة فقط — تعذّر تأكيد الخادم',
        entry:null,tp1:null,tp2:null,sl:null,
        reasons:['لا تصدر صفقة محلية عند انقطاع الخادم',...(advice.reasons||[])]
      };
    }
    const applied=applyAdvice(advice,{authoritative:true,isNew});

    refreshFeedStatus();

    if (lastLive && lastLive.price) {
      updatePivot(lastBars, lastLive.price);
    } else {
      updatePivot(lastBars, closes[closes.length-1]);
    }

    const last = lastBars[lastBars.length-1];
    logDebug(`تم جلب ${lastBars.length} شمعة مكتملة (${tf}) + ${lastMtfBars.map(x=>x.tf).join(',')||'بدون MTF'}. ${lastBarsQuality.reason}. آخر إغلاق: ${last.c}`);

    if (applied.isNew) {
      lastSignalSide=applied.ad.side;
      showToastSignal(applied.ad);
    }
  }catch(e){
    logDebug(`فشل جلب الشموع: ${e.message}`);
    lastBars = [];
    lastBarsSource='';
    lastBarsStorage='';
    lastBarsQuality={ok:false,gaps:0,duplicates:0,reason:'تعذّر فحص الشموع'};
    applyAdvice({side:'none',text:'مراقبة فقط — تعذّر تحديث البيانات',conf:0,entry:null,tp1:null,tp2:null,sl:null,reasons:['لم تُنشأ أي إشارة محلية']},{authoritative:true});
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
  if (!activeSignal || isTerminalSignalStatus(activeSignal.status)) {
    logDebug('لا توجد إشارة فعلية لإرسالها إلى تيليغرام');
    return;
  }
  const base = getBase();
  try{
    const r = await fetch(`${base}/notify`, {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({tf:activeSignal.tf,signalId:activeSignal.id})
    });
    const j = await r.json().catch(()=>({}));
    if (j.delivery) activeSignal.telegram=j.delivery;
    renderSignalMeta(activeSignal);
    logDebug(`Telegram: ${r.ok?'تم الإرسال':`فشل (${j.error||'غير معروف'})`}`);
  }catch(e){
    logDebug(`Telegram error: ${e.message}`);
  }
}

// ===== Backtest واقعي =====
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

function resampleHistoricalBars(bars,toTf,asOf){
  const duration=TF_MS[toTf];
  if (!duration) return [];
  const grouped=[];
  let current=null;
  for (const bar of bars) {
    const base=Math.floor(bar.t/duration)*duration;
    if (!current || current.t!==base) {
      if (current) grouped.push(current);
      current={t:base,o:bar.o,h:bar.h,l:bar.l,c:bar.c,v:Number(bar.v||0)};
    } else {
      current.h=Math.max(current.h,bar.h);
      current.l=Math.min(current.l,bar.l);
      current.c=bar.c;
      current.v+=Number(bar.v||0);
    }
  }
  if (current) grouped.push(current);
  return grouped.filter(bar=>bar.t+duration<=asOf);
}

function historicalMtfFrames(history,tf,asOf){
  return (HIGHER_TF[tf]||[]).map(higherTf=>({
    tf:higherTf,
    bars:resampleHistoricalBars(history,higherTf,asOf),
    source:'backtest'
  })).filter(frame=>frame.bars.length>=40);
}

function evaluateHistoricalTrade(signal,bars,startIndex,maxBars,costUsd=0){
  const risk=Math.abs(Number(signal.entry)-Number(signal.sl));
  if (!Number.isFinite(risk)||risk<=0) return null;
  const side=signal.side;
  let tp1Hit=false;
  let partialR=0;
  let ambiguous=false;
  let exitIndex=Math.min(bars.length-1,startIndex);
  let outcome='expired';
  let remainingExitR=0;
  const endIndex=Math.min(bars.length-1,startIndex+Math.max(1,maxBars)-1);

  for(let j=startIndex;j<=endIndex;j++){
    const bar=bars[j];
    const slHit=side==='buy'?bar.l<=signal.sl:bar.h>=signal.sl;
    const tp1Now=side==='buy'?bar.h>=signal.tp1:bar.l<=signal.tp1;
    const tp2Hit=side==='buy'?bar.h>=signal.tp2:bar.l<=signal.tp2;
    if (slHit && (tp1Now || tp2Hit)) ambiguous=true;

    // Conservative same-candle policy: when order is unknowable, count SL first.
    if (slHit) {
      remainingExitR=-1;
      outcome='sl';
      exitIndex=j;
      break;
    }
    if (tp2Hit) {
      if (!tp1Hit) {
        partialR=Math.abs(signal.tp1-signal.entry)/risk*0.5;
        tp1Hit=true;
      }
      remainingExitR=Math.abs(signal.tp2-signal.entry)/risk*0.5;
      outcome='tp2';
      exitIndex=j;
      break;
    }
    if (!tp1Hit && tp1Now) {
      partialR=Math.abs(signal.tp1-signal.entry)/risk*0.5;
      tp1Hit=true;
    }
    exitIndex=j;
  }

  if (outcome==='expired') {
    const close=Number(bars[exitIndex]?.c ?? signal.entry);
    const closeR=side==='buy'?(close-signal.entry)/risk:(signal.entry-close)/risk;
    remainingExitR=closeR*(tp1Hit?0.5:1);
  } else if (outcome==='sl' && tp1Hit) {
    remainingExitR*=0.5;
  }

  const grossR=partialR+remainingExitR;
  const costR=Math.max(0,Number(costUsd)||0)/risk;
  return {grossR,netR:grossR-costR,outcome,tp1Hit,ambiguous,exitIndex,risk,costR};
}

function wilsonInterval(wins,total,z=1.96){
  if (!total) return {low:0,high:0};
  const p=wins/total;
  const denominator=1+z*z/total;
  const center=(p+z*z/(2*total))/denominator;
  const margin=z*Math.sqrt((p*(1-p)+z*z/(4*total))/total)/denominator;
  return {low:Math.max(0,center-margin)*100,high:Math.min(1,center+margin)*100};
}

function backtestSampleLabel(summary){
  if (!summary||summary.trades<20) return 'عينة غير كافية';
  if (summary.oos&&summary.oos.trades<10) return 'اختبار خارجي ضعيف';
  if (summary.oos&&summary.oos.netR<=0) return 'غير ثابت خارج العينة';
  if (summary.trades<60) return 'نتيجة أولية';
  return 'عينة مقبولة';
}

function summarizeBacktestTrades(trades){
  let equity=0,peak=0,maxDD=0,grossProfit=0,grossLoss=0,wins=0;
  for(const trade of trades){
    equity+=trade.netR;
    peak=Math.max(peak,equity);
    maxDD=Math.max(maxDD,peak-equity);
    if (trade.netR>0){ wins++; grossProfit+=trade.netR; }
    else grossLoss+=Math.abs(trade.netR);
  }
  const count=trades.length;
  const interval=wilsonInterval(wins,count);
  const scored=trades.filter(trade=>Number.isFinite(Number(trade.conf)));
  const avgSignalScore=scored.length?scored.reduce((sum,trade)=>sum+Number(trade.conf),0)/scored.length:NaN;
  return {
    trades:count,
    netR:equity,
    winPct:count?wins/count*100:0,
    maxDD,
    profitFactor:grossLoss>0?grossProfit/grossLoss:(grossProfit>0?Infinity:0),
    avgR:count?equity/count:0,
    ambiguous:trades.filter(t=>t.ambiguous).length,
    winLow:interval.low,
    winHigh:interval.high,
    avgSignalScore,
    calibrationGap:Number.isFinite(avgSignalScore)?avgSignalScore-(count?wins/count*100:0):NaN
  };
}

function runBacktestOnBars(bars,options={}){
  if (!bars || bars.length<80) return null;
  const tf=options.tf||lastAnalysisTf||'1m';
  const duration=TF_MS[tf]||60000;
  const expectedMtf=(HIGHER_TF[tf]||[]).length;
  const costUsd=Math.max(0,Number(options.spread)||0)+Math.max(0,Number(options.slippage)||0)*2;
  const trades=[];

  for(let i=40;i<bars.length-1;i++){
    const history=bars.slice(0,i+1);
    const asOf=Number(bars[i].t)+duration;
    const mtf=historicalMtfFrames(history,tf,asOf);
    const ad=computeAdvice(history,{
      tf,mtf,expectedMtf,
      live:{price:bars[i].c,ts:bars[i].t,receivedAt:bars[i].t,source:'backtest'},
      barsSource:'backtest',
      enforceMTF:true,
      enforceFresh:false,
      pivots:calculateDailyPivots(history)
    });
    if (!['buy','sell'].includes(ad.side) || ![ad.entry,ad.tp1,ad.tp2,ad.sl].every(Number.isFinite)) continue;
    const maxBars=Math.max(1,Math.ceil(signalExpiryMs(tf)/duration));
    const result=evaluateHistoricalTrade(ad,bars,i+1,maxBars,costUsd);
    if (!result) continue;
    trades.push({...result,side:ad.side,signalIndex:i,entry:ad.entry,conf:ad.conf,createdAt:bars[i].t});
    i=Math.max(i,result.exitIndex);
  }

  const summary=summarizeBacktestTrades(trades);
  const splitIndex=Math.floor(bars.length*0.7);
  const oosDetails=trades.filter(trade=>trade.signalIndex>=splitIndex);
  const oos=summarizeBacktestTrades(oosDetails);
  const combined={...summary,oos,oosDetails,costUsd,tf,rows:bars.length,details:trades};
  return {...combined,sampleLabel:backtestSampleLabel(combined)};
}

function selectedBacktestTimeframes(){
  const selected=$$('.bt-tf:checked').map(el=>el.value).filter(tf=>TF_MS[tf]);
  return selected.length?selected:['5m','15m','30m','60m'];
}

function formatProfitFactor(value){
  return Number.isFinite(value)?value.toFixed(2):(value===Infinity?'∞':'—');
}

function renderBacktestResults(results,failures=[]){
  const valid=results.filter(Boolean);
  if (btTableBody) {
    btTableBody.innerHTML='';
    for(const res of valid){
      const row=document.createElement('tr');
      row.innerHTML=`<td>${res.tf}</td><td>${res.rows}</td><td>${res.trades}</td><td>${res.winPct.toFixed(1)}%</td><td>${res.winLow.toFixed(1)}–${res.winHigh.toFixed(1)}%</td><td>${res.netR>=0?'+':''}${res.netR.toFixed(2)}R</td><td>${res.maxDD.toFixed(2)}R</td><td>${formatProfitFactor(res.profitFactor)}</td><td>${res.oos.trades} • ${res.oos.netR>=0?'+':''}${res.oos.netR.toFixed(2)}R</td><td>${res.sampleLabel}</td>`;
      btTableBody.appendChild(row);
    }
    for(const failure of failures){
      const row=document.createElement('tr');
      row.innerHTML=`<td>${failure.tf}</td><td colspan="9" style="color:var(--bad)">${failure.message}</td>`;
      btTableBody.appendChild(row);
    }
  }

  const allTrades=valid.flatMap(res=>res.details||[]);
  const allOos=valid.flatMap(res=>res.oosDetails||[]);
  const total=summarizeBacktestTrades(allTrades);
  const totalOos=summarizeBacktestTrades(allOos);
  if (btTradesEl) btTradesEl.textContent=String(total.trades);
  if (btPLEl) btPLEl.textContent=`${total.netR>=0?'+':''}${total.netR.toFixed(2)}R`;
  if (btWinEl) btWinEl.textContent=total.winPct.toFixed(1)+'%';
  if (btDDEl) btDDEl.textContent=total.maxDD.toFixed(2)+'R';
  if (btPFEl) btPFEl.textContent=formatProfitFactor(total.profitFactor);
  if (btAvgREl) btAvgREl.textContent=`${total.avgR>=0?'+':''}${total.avgR.toFixed(2)}R`;
  if (btOosEl) btOosEl.textContent=`${totalOos.trades} صفقة • ${totalOos.winPct.toFixed(1)}% • ${totalOos.netR>=0?'+':''}${totalOos.netR.toFixed(2)}R`;
  if (btAmbiguousEl) btAmbiguousEl.textContent=String(total.ambiguous);

  if (btSummaryEl) {
    const noTrades=valid.length && total.trades===0?' • الشروط الحالية لم تنتج صفقات مؤكدة ضمن البيانات المتوفرة.':'';
    const interval=total.trades?` • نطاق Win% الإحصائي 95%: ${total.winLow.toFixed(1)}–${total.winHigh.toFixed(1)}%`:'';
    const calibration=Number.isFinite(total.avgSignalScore)?` • متوسط درجة النظام ${total.avgSignalScore.toFixed(1)}/100 (ليست احتمال ربح)`:'';
    const verdict=` • الحكم: ${backtestSampleLabel({...total,oos:totalOos})}`;
    const failed=failures.length?` • تعذّر: ${failures.map(item=>item.tf).join('، ')}`:'';
    btSummaryEl.textContent=`اختُبرت ${valid.length} فترة • الحالات الملتبسة تُحسب SL أولاً • النتائج تشمل Spread وSlippage.${interval}${calibration}${verdict}${noTrades}${failed}`;
  }
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
    pivotFilterOn:checked(pivotFilterOnEl),pivotDistance:value(pivotDistanceEl),
    newsInfluenceOn:checked(newsInfluenceOnEl)
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
  ['autoProfile','emaOn','rsiOn','macdOn','stochOn','bbOn','nyFilterOn','pivotFilterOn','newsInfluenceOn']
    .forEach(key=>setChecked({autoProfile:autoProfileEl,emaOn:emaOnEl,rsiOn:rsiOnEl,macdOn:macdOnEl,stochOn:stochOnEl,bbOn:bbOnEl,nyFilterOn:nyFilterOnEl,pivotFilterOn:pivotFilterOnEl,newsInfluenceOn:newsInfluenceOnEl}[key],key));
  const values={atrMode:atrModeEl,atrPeriod:atrPeriodEl,bbMode:bbModeEl,bbPeriod:bbPeriodEl,bbStd:bbStdEl,
    emaMode:emaModeEl,emaFast:emaFastInEl,emaSlow:emaSlowInEl,rsiMode:rsiModeEl,rsiPeriod:rsiPeriodEl,
    macdMode:macdModeEl,macdFast:macdFastEl,macdSlow:macdSlowEl,macdSig:macdSigEl,
    stochMode:stochModeEl,stochK:stochKEl,stochD:stochDEl,nyStart:nyStartEl,nyEnd:nyEndEl,pivotDistance:pivotDistanceEl};
  Object.entries(values).forEach(([key,el])=>setValue(el,key));
}

function recalculateCurrentAdvice(){
  if (!lastBars||!lastBars.length) return;
  analyzeMarket(lastBars,lastBars.map(b=>b.c));
  const ad=computeAdvice(lastBars,{tf:lastAnalysisTf,mtf:lastMtfBars,expectedMtf:(HIGHER_TF[lastAnalysisTf]||[]).length,live:lastLive,barsSource:lastBarsSource,barsStorage:lastBarsStorage,dataQuality:lastBarsQuality,feedIntegrityBlocked,feedIntegrityReason,news:newsContextForAdvice(),enforceMTF:true,enforceFresh:true});
  applyAdvice(ad);
  updatePivot(lastBars,lastLive?.price||lastBars.at(-1)?.c);
}

// ===== ربط الـ UI =====
function setupUI(){
  if (saveBase) saveBase.addEventListener('click', ()=>{
    setBase(baseIn.value);
    stopLiveStream();
    liveStreamEnabled=true;
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

  [showBBEl,showMacdEl,showRsiEl,showStochEl].filter(Boolean).forEach(el=>{
    el.addEventListener('change',()=>{
      applyChartDisplay();
      saveChartDisplaySettings();
    });
  });

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
      const oldText=btnBacktest.textContent;
      btnBacktest.disabled=true;
      btnBacktest.textContent='جاري جلب الشموع والاختبار…';
      if (btSummaryEl) btSummaryEl.textContent='عم نختبر الفترات واحدة واحدة من دون صفقات متداخلة…';
      try{
        const options={spread:Number(btSpreadEl?.value||0),slippage:Number(btSlippageEl?.value||0)};
        const results=[];
        const failures=[];
        if (csvFileEl.files && csvFileEl.files[0]){
          const text=await csvFileEl.files[0].text();
          const bars=parseCsv(text);
          const tf=lastAnalysisTf||'1m';
          const res=runBacktestOnBars(bars,{...options,tf});
          if (res) results.push(res);
          else failures.push({tf,message:'الملف يحتاج 80 شمعة صحيحة على الأقل'});
        } else {
          const base=getBase();
          const limit=Math.max(300,Math.min(Number(limitIn?.value||1200),1200));
          for(const tf of selectedBacktestTimeframes()){
            try{
              const frame=await fetchBarsFrame(base,tf,limit);
              const res=runBacktestOnBars(frame.bars,{...options,tf});
              if (res) results.push(res);
              else failures.push({tf,message:`بيانات غير كافية (${frame.bars.length} شمعة)`});
            }catch(error){
              failures.push({tf,message:error?.message||'فشل جلب الشموع'});
            }
            await new Promise(resolve=>setTimeout(resolve,0));
          }
        }
        renderBacktestResults(results,failures);
      }finally{
        btnBacktest.disabled=false;
        btnBacktest.textContent=oldText;
      }
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
    nyFilterOnEl,nyStartEl,nyEndEl,pivotFilterOnEl,pivotDistanceEl,newsInfluenceOnEl];
  savedFields.filter(Boolean).forEach(el=>el.addEventListener('change',()=>{
    saveSignalSettings();
    recalculateCurrentAdvice();
  }));
}

// ===== Bootstrap =====
document.addEventListener('DOMContentLoaded', ()=>{
  setBase(getBase());
  restoreSignalSettings();
  restoreChartDisplaySettings();
  restoreActiveSignal();
  setupUI();
  applyModeProfile(lastMarketState);
  ensureCharts();
  startPriceLoop();
  fetchBarsAndUpdate();
  // Refresh only completed candles; live movement is shown by the blue price line.
  setInterval(fetchBarsAndUpdate, 15000);
});

document.addEventListener('visibilitychange',()=>{
  if (document.hidden) {
    liveStreamEnabled=false;
    stopLiveStream();
    logDebug('إيقاف البث في الصفحة المخفية لتوفير اتصال Twelve Data');
    return;
  }
  liveStreamEnabled=true;
  connectLiveStream();
  fetchPriceOnce();
});

window.addEventListener('gsx:news-updated',()=>recalculateCurrentAdvice());
