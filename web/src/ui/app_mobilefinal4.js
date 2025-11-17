// GoldSignalsX Mobile main UI logic (module)

// Core imports
import { fetchPrice, fetchBars, exportCSV, notifyTelegram } from '../lib/datafeed.js';
import {
  computeATR,
  computeBB,
  computeADX,
  computeRSI,
  computeMACD,
  computeStochastic,
  ema
} from '../core/indicators.js';
import { classifyRegime } from '../core/regime.js';
import { detectCandles } from '../core/candles.js';
import { drawChart } from './chart.js';
import { plotLine, plotMACD } from './panels.js';
import { runBacktest } from './backtest.js';

const LS_BASE_KEY  = 'GSX_BASE_URL';
const LS_TF_KEY    = 'GSX_TF';
const LS_LIMIT_KEY = 'GSX_LIMIT';
const DEFAULT_BASE = 'https://goldsignalsx-worker.samer-mourtada.workers.dev';

const state = {
  base: DEFAULT_BASE,
  tf: '1m',
  limit: 1200,
  bars: [],
  live: null,
  indicators: null,
  regimeInfo: null,
  levels: null,
};

function $(id) { return document.getElementById(id); }

// --------------------------------------
// Toast
// --------------------------------------
function showToast(title, msg) {
  const toast = $('toast');
  if (!toast) return;
  const tTitle = $('toastTitle');
  const tMsg   = $('toastMsg');
  if (tTitle) tTitle.textContent = title || '';
  if (tMsg)   tMsg.textContent   = msg   || '';
  toast.style.display = 'block';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}
function hideToast() {
  const toast = $('toast');
  if (toast) toast.classList.remove('show');
}

// --------------------------------------
// Base URL helpers
// --------------------------------------
function normalizeBase(v) {
  if (!v) return '';
  return String(v).trim().replace(/\/+$/, '');
}
function loadBaseFromStorage() {
  const input  = $('base');
  const stored = localStorage.getItem(LS_BASE_KEY);
  const val    = normalizeBase(stored || input?.value || DEFAULT_BASE);
  state.base   = val || DEFAULT_BASE;
  if (input) input.value = state.base;
  return state.base;
}
function saveBase() {
  const input = $('base');
  const v     = normalizeBase(input?.value || '');
  if (!v) {
    showToast('تحذير', 'الرجاء إدخال رابط الووركر');
    return;
  }
  state.base = v;
  localStorage.setItem(LS_BASE_KEY, v);
  if (input) input.value = v;
  showToast('تم الحفظ', 'تم حفظ رابط الووركر بنجاح.');
}

// --------------------------------------
// TF & limit
// --------------------------------------
function initTfBar() {
  const bar = $('tfBar');
  if (!bar) return;

  const savedTf = localStorage.getItem(LS_TF_KEY) || '1m';
  state.tf = savedTf;

  [...bar.querySelectorAll('button[data-tf]')].forEach(btn => {
    const tf = btn.getAttribute('data-tf');
    if (tf === savedTf) btn.classList.add('primary');
    btn.addEventListener('click', () => {
      [...bar.querySelectorAll('button[data-tf]')].forEach(b => b.classList.remove('primary'));
      btn.classList.add('primary');
      state.tf = tf;
      localStorage.setItem(LS_TF_KEY, tf);
    });
  });

  const limitInput = $('limit');
  if (limitInput) {
    const savedLimit = parseInt(
      localStorage.getItem(LS_LIMIT_KEY) || limitInput.value || '1200',
      10
    );
    state.limit = Number.isFinite(savedLimit) ? savedLimit : 1200;
    limitInput.value = String(state.limit);
    limitInput.addEventListener('change', () => {
      const v = parseInt(limitInput.value || '1200', 10);
      state.limit = (Number.isFinite(v) && v >= 100) ? v : 1200;
      limitInput.value = String(state.limit);
      localStorage.setItem(LS_LIMIT_KEY, String(state.limit));
    });
  }
}

// --------------------------------------
// Live price
// --------------------------------------
function fmtTime(ts) {
  const d   = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function refreshPrice(manual = false) {
  try {
    const base = state.base || loadBaseFromStorage();
    const meta = await fetchPrice(base);
    state.live = meta;

    const pEl   = $('price');
    const srcEl = $('liveSource');
    const tEl   = $('liveDateTime');

    if (pEl)   pEl.textContent   = (Math.round(meta.price * 1000) / 1000).toString();
    if (srcEl) srcEl.textContent = meta.source || 'worker';
    if (tEl)   tEl.textContent   = meta.ts ? fmtTime(meta.ts) : '';

    if (manual) showToast('تم', 'تم تحديث السعر الحي.');
    renderAll(); // إعادة رسم الشارت مع السعر الحي الجديد
  } catch (e) {
    console.warn('refreshPrice failed', e);
    showToast('خطأ', 'تعذّر جلب السعر الحي.');
  }
}

function startAutoPrice() {
  refreshPrice(false).catch(() => {});
  setInterval(() => refreshPrice(false).catch(() => {}), 5000);
}

// --------------------------------------
// Fetch bars + main pipeline
// --------------------------------------
async function fetchBarsAndRender() {
  try {
    const base  = state.base || loadBaseFromStorage();
    const tf    = state.tf;
    const input = $('limit');
    const lim   = input ? parseInt(input.value || '1200', 10) : state.limit;
    state.limit = (Number.isFinite(lim) && lim > 0) ? lim : 1200;
    if (input) input.value = String(state.limit);

    const bars = await fetchBars(base, tf, state.limit);
    if (!Array.isArray(bars) || bars.length === 0) {
      showToast('تنبيه', 'لا توجد شموع كافية من الووركر.');
      state.bars = [];
      renderAll();
      return;
    }
    state.bars = bars;
    showToast('تم', `تم جلب ${bars.length} شمعة.`);
    renderAll();
  } catch (e) {
    console.warn('fetchBars failed', e);
    showToast('خطأ', 'تعذّر جلب الشموع من الووركر.');
  }
}

// --------------------------------------
// Indicators & regime
// --------------------------------------
function computeAllIndicators() {
  const bars = state.bars;
  if (!Array.isArray(bars) || bars.length < 20) {
    state.indicators = null;
    state.regimeInfo = null;
    return;
  }
  const closes = bars.map(b => b.c);
  const highs  = bars.map(b => b.h);
  const lows   = bars.map(b => b.l);

  // ATR
  const atrMode = $('atrMode')?.value || 'auto';
  const atrP = atrMode === 'manual'
    ? parseInt($('atrPeriod')?.value || '14', 10)
    : 14;
  const atr = computeATR(bars, atrP);

  // BB
  const bbMode   = $('bbMode')?.value || 'auto';
  const bbPeriod = bbMode === 'manual'
    ? parseInt($('bbPeriod')?.value || '20', 10)
    : 20;
  const bbStd = bbMode === 'manual'
    ? parseFloat($('bbStd')?.value || '2')
    : 2;
  const bb = computeBB(closes, bbPeriod, bbStd);

  // ADX + Regime
  const adx    = computeADX(bars, 14);
  const regime = classifyRegime(bars, closes);

  // RSI / MACD / Stoch
  const rsi      = computeRSI(closes, 14);
  const macdObj  = computeMACD(closes, 12, 26, 9);
  const stochObj = computeStochastic(highs, lows, closes, 14, 3, 3);

  // EMAs
  const emaFast = ema(closes, 12);
  const emaSlow = ema(closes, 26);

  state.indicators = {
    atrP,
    atr,
    bb,
    adx,
    rsi,
    macdObj,
    stochObj,
    emaFast,
    emaSlow,
  };
  state.regimeInfo = regime;
}

function updateIndicatorsUI() {
  const ind = state.indicators;
  const reg = state.regimeInfo;

  if (!ind || !reg) {
    [
      'atrVal', 'bbMA', 'bbUp', 'bbLo',
      'bbWidth', 'adxVal', 'rsiVal', 'macdVal',
      'stochVal', 'emaFast', 'emaSlow', 'regimeTop'
    ].forEach(id => {
      const el = $(id);
      if (el) el.textContent = '—';
    });
    const mState = $('marketState');
    if (mState) mState.textContent = 'الحالة: —';
    return;
  }

  const { atr, bb, adx, rsi, macdObj, stochObj, emaFast, emaSlow } = ind;

  if ($('atrVal')) $('atrVal').textContent = atr ? atr.toFixed(2) : '—';

  if (bb) {
    if ($('bbMA'))    $('bbMA').textContent    = bb.ma.toFixed(2);
    if ($('bbUp'))    $('bbUp').textContent    = bb.upper.toFixed(2);
    if ($('bbLo'))    $('bbLo').textContent    = bb.lower.toFixed(2);
    if ($('bbWidth')) $('bbWidth').textContent = (bb.width * 100).toFixed(2) + '%';
  } else {
    ['bbMA', 'bbUp', 'bbLo', 'bbWidth'].forEach(id => {
      const el = $(id);
      if (el) el.textContent = '—';
    });
  }

  if ($('adxVal'))   $('adxVal').textContent   = adx ? adx.toFixed(1) : '—';
  if ($('rsiVal'))   $('rsiVal').textContent   = rsi ? rsi.toFixed(1) : '—';
  if ($('macdVal'))  $('macdVal').textContent  =
    (macdObj && macdObj.macd != null) ? macdObj.macd.toFixed(2) : '—';
  if ($('stochVal')) $('stochVal').textContent =
    (stochObj && stochObj.k != null) ? stochObj.k.toFixed(1) : '—';
  if ($('emaFast'))  $('emaFast').textContent  = emaFast ? emaFast.toFixed(2) : '—';
  if ($('emaSlow'))  $('emaSlow').textContent  = emaSlow ? emaSlow.toFixed(2) : '—';

  const regimeTop = $('regimeTop');
  if (regimeTop) regimeTop.textContent = reg.regime || '—';

  const mState = $('marketState');
  if (mState) {
    let txt = 'الحالة: ';
    if (reg.regime === 'TREND') txt += 'سوق اتجاهي';
    else if (reg.regime === 'RANGE') txt += 'سوق عرضي / تذبذب';
    else txt += 'محايد';

    txt += ` • ADX ${(reg.adx || 0).toFixed(1)} • BBW ${(reg.bbWidth * 100 || 0).toFixed(1)}%`;
    mState.textContent = txt;
  }
}

// --------------------------------------
// Advice / levels
// --------------------------------------
function computeLevelsAndAdvice() {
  const bars = state.bars;
  const ind  = state.indicators;
  if (!bars || bars.length < 30 || !ind) {
    state.levels = null;
    const adv = $('adviceText');
    if (adv) adv.textContent = 'لا توجد بيانات كافية لإعطاء نصيحة.';
    ['entryVal', 'tp1Val', 'tp2Val', 'slVal', 'confVal'].forEach(id => {
      const el = $(id);
      if (el) el.textContent = '—';
    });
    const list = $('reasonsList');
    if (list) list.innerHTML = '';
    return;
  }

  const last    = bars[bars.length - 1];
  const price   = state.live?.price || last.c;
  const { atr, rsi, macdObj, stochObj, emaFast, emaSlow } = ind;
  const regime  = state.regimeInfo;

  const reasons = [];
  let dir = 0; // +1 buy, -1 sell

  if (emaFast && emaSlow) {
    if (emaFast > emaSlow * 1.0005) {
      dir += 1;
      reasons.push('المتوسط السريع فوق البطيء → ميل صعودي.');
    } else if (emaFast < emaSlow * 0.9995) {
      dir -= 1;
      reasons.push('المتوسط السريع تحت البطيء → ميل هبوطي.');
    }
  }

  if (rsi) {
    if (rsi < 30) {
      dir += 1;
      reasons.push('RSI في منطقة تشبّع بيع.');
    } else if (rsi > 70) {
      dir -= 1;
      reasons.push('RSI في منطقة تشبّع شراء.');
    }
  }

  if (macdObj && macdObj.macd != null && macdObj.signal != null) {
    if (macdObj.macd > macdObj.signal) {
      dir += 0.5;
      reasons.push('MACD فوق الإشارة → زخم إيجابي.');
    } else if (macdObj.macd < macdObj.signal) {
      dir -= 0.5;
      reasons.push('MACD تحت الإشارة → زخم سلبي.');
    }
  }

  if (stochObj && stochObj.k != null) {
    if (stochObj.k < 25) {
      dir += 0.5;
      reasons.push('Stochastic منخفض → ممكن ارتداد صعودي.');
    } else if (stochObj.k > 80) {
      dir -= 0.5;
      reasons.push('Stochastic مرتفع → ممكن تصحيح هبوطي.');
    }
  }

  if (regime?.regime === 'TREND') {
    reasons.push('السوق في طور اتجاهي؛ الإشارات أقوى.');
  } else if (regime?.regime === 'RANGE') {
    reasons.push('السوق عرضي؛ الحركات قد تكون محدودة.');
  }

  let side = 0;
  if (dir > 0.75) side = +1;
  else if (dir < -0.75) side = -1;

  const adv = $('adviceText');
  let conf  = 0;
  let entry = price;
  let sl, tp1, tp2;

  if (!side) {
    if (adv) adv.textContent = 'لا توجد إشارة قوية واضحة حاليًا؛ يُفضَّل الانتظار.';
    conf = 30;
  } else if (side > 0) {
    const a = atr || (last.h - last.l) || (price * 0.004);
    sl  = price - 1.5 * a;
    tp1 = price + 1.5 * a;
    tp2 = price + 2.5 * a;
    conf = 60 + Math.min(Math.abs(dir) * 10, 30);
    if (adv) adv.textContent = 'ميل إلى صفقة شراء (Long) مع وقف خسارة أسفل السعر وأهداف أعلى.';
  } else {
    const a = atr || (last.h - last.l) || (price * 0.004);
    sl  = price + 1.5 * a;
    tp1 = price - 1.5 * a;
    tp2 = price - 2.5 * a;
    conf = 60 + Math.min(Math.abs(dir) * 10, 30);
    if (adv) adv.textContent = 'ميل إلى صفقة بيع (Short) مع وقف خسارة أعلى السعر وأهداف أدنى.';
  }

  if (side) {
    reasons.push(`السعر الحالي تقريبًا: ${price.toFixed(2)}`);
    reasons.push('المستويات محسوبة بناءً على ATR وهي تقريبية للمساعدة فقط وليست توصية أكيدة.');
  }

  state.levels = side ? { side, entry, sl, tp1, tp2, conf } : null;

  if ($('entryVal')) $('entryVal').textContent = entry ? entry.toFixed(2) : '—';
  if ($('tp1Val'))   $('tp1Val').textContent   = tp1   ? tp1.toFixed(2)   : '—';
  if ($('tp2Val'))   $('tp2Val').textContent   = tp2   ? tp2.toFixed(2)   : '—';
  if ($('slVal'))    $('slVal').textContent    = sl    ? sl.toFixed(2)    : '—';
  if ($('confVal'))  $('confVal').textContent  = conf  ? conf.toFixed(0) + '%' : '—';

  const list = $('reasonsList');
  if (list) {
    list.innerHTML = '';
    reasons.forEach(r => {
      const li = document.createElement('li');
      li.textContent = r;
      list.appendChild(li);
    });
  }
}

// --------------------------------------
// Panels (MACD / RSI / Stoch)
// --------------------------------------
function renderPanels() {
  const bars = state.bars;
  if (!bars || !bars.length) {
    ['macdPanel', 'rsiPanel', 'stochPanel'].forEach(id => {
      const c = $(id);
      if (c) {
        const ctx = c.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, c.width, c.height);
      }
    });
    return;
  }

  const closes = bars.map(b => b.c);
  const highs  = bars.map(b => b.h);
  const lows   = bars.map(b => b.l);

  const showMacd  = $('showMacd')?.checked ?? true;
  const showRsi   = $('showRsi')?.checked ?? true;
  const showStoch = $('showStoch')?.checked ?? false;

  // MACD
  if (showMacd) {
    const mac       = computeMACD(closes, 12, 26, 9);
    const mArr      = mac?.series?.macd   || mac?.macdSeries   || [];
    const sArr      = mac?.series?.signal || mac?.signalSeries || [];
    const hArr      = mac?.series?.hist   || mac?.histSeries   || [];
    const macdPanel = $('macdPanel');
    if (macdPanel) plotMACD(macdPanel, mArr, sArr, hArr);
  } else {
    const c = $('macdPanel');
    if (c) {
      const ctx = c.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, c.width, c.height);
    }
  }

  // RSI
  if (showRsi) {
    const rsiSeries = [];
    for (let i = 10; i <= closes.length; i++) {
      const v = computeRSI(closes.slice(0, i), 14);
      if (v != null) rsiSeries.push(v);
    }
    const c = $('rsiPanel');
    if (c) plotLine(c, rsiSeries, {
      min: 0,
      max: 100,
      hlines: [
        { y: 30, color: '#10b981' },
        { y: 70, color: '#ef4444' },
      ],
    });
  } else {
    const c = $('rsiPanel');
    if (c) {
      const ctx = c.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, c.width, c.height);
    }
  }

  // Stochastic
  if (showStoch) {
    const stSeries = [];
    for (let i = 14; i <= closes.length; i++) {
      const winH = Math.max(...highs.slice(i - 14, i));
      const winL = Math.min(...lows.slice(i - 14, i));
      const cVal = closes[i - 1];
      const k    = ((cVal - winL) / Math.max(winH - winL, 1e-6)) * 100;
      stSeries.push(k);
    }
    const c = $('stochPanel');
    if (c) plotLine(c, stSeries, {
      min: 0,
      max: 100,
      hlines: [
        { y: 20, color: '#10b981' },
        { y: 80, color: '#ef4444' },
      ],
    });
  } else {
    const c = $('stochPanel');
    if (c) {
      const ctx = c.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, c.width, c.height);
    }
  }
}

// --------------------------------------
// Main chart
// --------------------------------------
function renderChart() {
  const canvas = $('chart');
  const bars   = state.bars;
  if (!canvas || !bars || !bars.length) {
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    return;
  }

  const livePrice = state.live?.price || null;
  const showBB    = $('showBB')?.checked ?? true;
  const levels    = state.levels;

  const markers = levels ? {
    entry: levels.entry,
    sl:    levels.sl,
    tp1:   levels.tp1,
    tp2:   levels.tp2,
  } : null;

  const opts = {
    bb:       { on: !!showBB },
    patterns: { on: false, list: [] },
  };
  drawChart(canvas, bars, livePrice, markers, opts);
}

// --------------------------------------
// Pivot levels
// --------------------------------------
function computePivotLevels() {
  const bars = state.bars;
  if (!bars || bars.length === 0) return null;
  const last = bars[bars.length - 1];
  const H = last.h, L = last.l, C = last.c;
  const P  = (H + L + C) / 3;
  const R1 = 2 * P - L;
  const S1 = 2 * P - H;
  const R2 = P + (H - L);
  const S2 = P - (H - L);
  const R3 = H + 2 * (P - L);
  const S3 = L - 2 * (H - P);
  return { P, R1, R2, R3, S1, S2, S3, base: last };
}

function renderPivot() {
  const tbl  = $('pivotTable');
  const info = $('pivotPrice');
  if (!tbl || !info) return;
  const tbody = tbl.querySelector('tbody');
  if (!tbody) return;

  const piv   = computePivotLevels();
  const price = state.live?.price || (state.bars[state.bars.length - 1]?.c || null);
  if (!piv || !price) {
    tbody.innerHTML = '';
    info.textContent = 'لا يمكن حساب الـ Pivot حاليًا.';
    return;
  }

  const rows = [
    ['S3', piv.S3, 'دعم بعيد قوي محتمل'],
    ['S2', piv.S2, 'دعم متوسط'],
    ['S1', piv.S1, 'دعم أول'],
    ['P',  piv.P,  'المحور الرئيسي لليوم'],
    ['R1', piv.R1, 'مقاومة أولى'],
    ['R2', piv.R2, 'مقاومة متوسطة'],
    ['R3', piv.R3, 'مقاومة بعيدة قوية محتملة'],
  ];

  tbody.innerHTML = '';
  rows.forEach(([name, val, desc]) => {
    const tr   = document.createElement('tr');
    const diff = ((val - price) / price) * 100;
    tr.innerHTML = `
      <td>${name}</td>
      <td>${val.toFixed(2)}</td>
      <td>${diff > 0 ? '+' : ''}${diff.toFixed(2)}%</td>
      <td>${desc}</td>
    `;
    tbody.appendChild(tr);
  });

  info.textContent = `Pivot محسوب من آخر شمعة • السعر الحالي المُستخدم: ${price.toFixed(2)}`;
}

// --------------------------------------
// Backtest
// --------------------------------------
function renderBacktest() {
  const bars = state.bars;
  if (!bars || bars.length < 80) {
    if ($('btPL'))  $('btPL').textContent  = '—';
    if ($('btWin')) $('btWin').textContent = '—';
    if ($('btDD'))  $('btDD').textContent  = '—';
    return;
  }
  const res = runBacktest(bars, { atrMult: 1.3 });
  if ($('btPL'))  $('btPL').textContent  = res.pl.toFixed(2);
  if ($('btWin')) $('btWin').textContent = res.win.toFixed(1) + '%';
  if ($('btDD'))  $('btDD').textContent  = res.maxDD.toFixed(2);
}

// --------------------------------------
// Telegram notify
// --------------------------------------
async function sendToTelegram() {
  try {
    const base = state.base || loadBaseFromStorage();
    const lv   = state.levels;
    if (!lv) {
      showToast('تنبيه', 'لا توجد صفقة محسوبة لإرسالها.');
      return;
    }
    const payload = {
      side:  lv.side > 0 ? 'BUY' : 'SELL',
      entry: lv.entry,
      sl:    lv.sl,
      tp1:   lv.tp1,
      tp2:   lv.tp2,
      tf:    state.tf,
    };
    await notifyTelegram(base, payload);
    showToast('تم', 'تم إرسال الصفقة إلى تيليغرام (إن تم إعداد الووركر).');
  } catch (e) {
    console.warn('notify failed', e);
    showToast('خطأ', 'تعذّر الإرسال إلى تيليغرام.');
  }
}

// --------------------------------------
// Tabs
// --------------------------------------
function initTabs() {
  const buttons = document.querySelectorAll('nav.tabs button[data-tab]');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('main > section.tab').forEach(sec => {
        if (sec.id === 'tab-' + tab) sec.style.display = '';
        else sec.style.display = 'none';
      });
    });
  });
}

// --------------------------------------
// Render pipeline
// --------------------------------------
function renderAll() {
  computeAllIndicators();
  updateIndicatorsUI();
  computeLevelsAndAdvice();
  renderChart();
  renderPanels();
  renderBacktest();
  renderPivot();
}

// --------------------------------------
// Init
// --------------------------------------
function init() {
  loadBaseFromStorage();
  initTfBar();
  initTabs();

  const btnSave = $('saveBase');
  if (btnSave) btnSave.addEventListener('click', saveBase);

  const btnPrice = $('btnPrice');
  if (btnPrice) btnPrice.addEventListener('click', () => refreshPrice(true));

  const btnBars = $('btnBars');
  if (btnBars) btnBars.addEventListener('click', fetchBarsAndRender);

  const btnCSV = $('btnCSV');
  if (btnCSV) btnCSV.addEventListener('click', () => {
    const base = state.base || loadBaseFromStorage();
    exportCSV(base, state.tf);
  });

  const btnNotify = $('btnNotify');
  if (btnNotify) btnNotify.addEventListener('click', sendToTelegram);

  const btnRecalc = $('btnRecalc');
  if (btnRecalc) btnRecalc.addEventListener('click', renderAll);

  const toastClose = $('toastClose');
  if (toastClose) toastClose.addEventListener('click', hideToast);

  // Indicator mode toggles
  const atrMode   = $('atrMode');
  const bbMode    = $('bbMode');
  const atrPeriod = $('atrPeriod');
  const bbPeriod  = $('bbPeriod');
  const bbStd     = $('bbStd');

  if (atrMode) {
    atrMode.addEventListener('change', () => {
      const manual = atrMode.value === 'manual';
      if (atrPeriod) atrPeriod.disabled = !manual;
      renderAll();
    });
  }
  if (bbMode) {
    bbMode.addEventListener('change', () => {
      const manual = bbMode.value === 'manual';
      if (bbPeriod) bbPeriod.disabled = !manual;
      if (bbStd)    bbStd.disabled    = !manual;
      renderAll();
    });
  }
  if (atrPeriod) atrPeriod.addEventListener('change', renderAll);
  if (bbPeriod)  bbPeriod.addEventListener('change', renderAll);
  if (bbStd)     bbStd.addEventListener('change', renderAll);

  ['showBB', 'showMacd', 'showRsi', 'showStoch'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('change', () => {
      renderChart();
      renderPanels();
    });
  });

  // Auto start price polling
  startAutoPrice();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
