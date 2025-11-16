// GoldSignalsX – Mobile UI logic
// يعتمد على:
// - index.html الحالي
// - Worker جاهز يرجّع /price و /bars
// - LightweightCharts (من الCDN في index)

const DEFAULT_BASE = 'https://goldsignalsx-worker.samer-mourtada.workers.dev';
const LS_KEY = 'GSX_BASE_URL';

const $ = (s) => document.querySelector(s);

// ---------- Base URL ----------

function getSavedBase() {
  try {
    return (localStorage.getItem(LS_KEY) || '').trim();
  } catch {
    return '';
  }
}

function setSavedBase(v) {
  const clean = String(v || '').trim().replace(/\/+$/, '');
  try {
    if (clean) localStorage.setItem(LS_KEY, clean);
    else localStorage.removeItem(LS_KEY);
  } catch {}
  const el = $('#base');
  if (el) el.value = clean || DEFAULT_BASE;
  return clean || DEFAULT_BASE;
}

function getBase() {
  const el = $('#base');
  const fromUI = (el && el.value || '').trim();
  return (fromUI || getSavedBase() || DEFAULT_BASE).replace(/\/+$/, '');
}

// ---------- Live price polling ----------

let priceTimer = null;

async function fetchPriceOnce() {
  const base = getBase().replace(/\/+$/, '');
  const urls = [
    `${base}/price`,
    `${base}/api/price`,
  ];

  let lastErr = null;

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        lastErr = new Error('HTTP ' + res.status);
        continue;
      }
      const j = await res.json();
      const price =
        j.price ??
        j.last ??
        j.close ??
        j.c ??
        null;

      const ts =
        j.ts ??
        j.time ??
        j.t ??
        Date.now();

      if (price == null || !Number.isFinite(Number(price))) {
        lastErr = new Error('Bad price JSON');
        continue;
      }

      return { price: Number(price), ts, source: j.source || 'worker' };
    } catch (e) {
      lastErr = e;
    }
  }

  if (lastErr) {
    console.warn('[GSX] price error:', lastErr);
  }

  return null;
}

function updatePriceUI(meta) {
  const priceEl = $('#price');
  if (!priceEl) return;

  if (!meta) {
    priceEl.textContent = '—';
    priceEl.style.color = '#9ca3af';
  } else {
    priceEl.textContent = (Math.round(meta.price * 1000) / 1000).toString();
    priceEl.style.color = '#22c55e';
  }

  const dtEl = $('#liveDateTime');
  if (dtEl && meta) {
    try {
      const d = new Date(meta.ts || Date.now());
      const pad = (n) => (n < 10 ? '0' + n : '' + n);
      dtEl.textContent =
        d.getFullYear() +
        '-' +
        pad(d.getMonth() + 1) +
        '-' +
        pad(d.getDate()) +
        ' ' +
        pad(d.getHours()) +
        ':' +
        pad(d.getMinutes()) +
        ':' +
        pad(d.getSeconds());
    } catch {
      // ignore
    }
  }
}

async function priceTick() {
  const meta = await fetchPriceOnce();
  updatePriceUI(meta);
}

function startPricePolling() {
  if (priceTimer) return;
  priceTick(); // أول واحدة فوراً
  priceTimer = setInterval(priceTick, 1000);
}

function stopPricePolling() {
  if (priceTimer) {
    clearInterval(priceTimer);
    priceTimer = null;
  }
}

// ---------- Tabs ----------

function setupTabs() {
  const tabsBar = $('#tabsBar');
  if (!tabsBar) return;
  const sections = {
    home: $('#tab-home'),
    bt: $('#tab-bt'),
    pivot: $('#tab-pivot'),
  };

  function activate(tab) {
    tabsBar.querySelectorAll('button[data-tab]').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    Object.entries(sections).forEach(([k, sec]) => {
      if (!sec) return;
      sec.style.display = (k === tab) ? 'block' : 'none';
    });
  }

  tabsBar.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-tab]');
    if (!btn) return;
    activate(btn.dataset.tab);
  });

  activate('home');
}

// ---------- TF Bar ----------

function setupTFBar(onChange) {
  const bar = $('#tfBar');
  if (!bar) return;

  function setActive(btn) {
    bar.querySelectorAll('button[data-tf]').forEach((b) => {
      b.classList.remove('active');
      b.classList.remove('primary');
    });
    if (btn) {
      btn.classList.add('active');
      btn.classList.add('primary');
    }
  }

  bar.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-tf]');
    if (!btn) return;
    setActive(btn);
    if (onChange) onChange(getCurrentTF());
  });

  function getCurrentTF() {
    const active = bar.querySelector('button[data-tf].active');
    return active ? (active.getAttribute('data-tf') || '5m') : '5m';
  }

  const first = bar.querySelector('button[data-tf].primary') || bar.querySelector('button[data-tf]');
  if (first) setActive(first);

  return { getCurrentTF };
}

// ---------- Chart ----------

let mainChart = null;
let mainSeries = null;

function ensureMainChart() {
  const wrap = $('#chartWrap');
  if (!wrap) return null;
  if (mainChart && mainSeries) return { chart: mainChart, series: mainSeries };

  mainChart = LightweightCharts.createChart(wrap, {
    height: 260,
    layout: {
      background: { type: 'solid', color: '#020617' },
      textColor: '#e5e7eb',
    },
    grid: {
      vertLines: { color: '#111827' },
      horzLines: { color: '#111827' },
    },
    rightPriceScale: {
      borderVisible: false,
    },
    timeScale: {
      borderVisible: true,
      borderColor: '#1f2937',
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
    },
  });

  mainSeries = mainChart.addCandlestickSeries({
    upColor: '#22c55e',
    downColor: '#ef4444',
    borderUpColor: '#22c55e',
    borderDownColor: '#ef4444',
    wickUpColor: '#22c55e',
    wickDownColor: '#ef4444',
  });

  window.gsx = window.gsx || {};
  window.gsx.lw = { chart: mainChart, series: mainSeries };

  const resizeObserver = new ResizeObserver(() => {
    if (!wrap || !mainChart) return;
    const rect = wrap.getBoundingClientRect();
    mainChart.applyOptions({ width: rect.width });
  });
  resizeObserver.observe(wrap);

  return { chart: mainChart, series: mainSeries };
}

function barsToCandleData(bars) {
  if (!Array.isArray(bars)) return [];
  return bars
    .filter((b) => b && b.o != null && b.h != null && b.l != null && b.c != null)
    .map((b) => {
      const t = b.t ?? b.time ?? b.ts ?? Date.now();
      return {
        time: Math.floor(t / 1000),
        open: Number(b.o),
        high: Number(b.h),
        low: Number(b.l),
        close: Number(b.c),
      };
    });
}

// ---------- Indicators ----------

function calcATR(bars, period = 14) {
  if (!Array.isArray(bars) || bars.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1];
    const cur = bars[i];
    const high = cur.h;
    const low = cur.l;
    const prevClose = prev.c;
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trs.push(tr);
  }
  if (trs.length < period) return null;
  const recent = trs.slice(-period);
  const atr = recent.reduce((a, b) => a + b, 0) / period;
  return atr;
}

function calcRSI(closes, period = 14) {
  if (!Array.isArray(closes) || closes.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  if (gains === 0 && losses === 0) return 50;
  const rs = gains / (losses || 1e-9);
  const rsi = 100 - 100 / (1 + rs);
  return rsi;
}

function ema(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  const k = 2 / (period + 1);
  let emaVal = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    emaVal = values[i] * k + emaVal * (1 - k);
  }
  return emaVal;
}

function calcMACD(closes, fast = 12, slow = 26, signal = 9) {
  if (!Array.isArray(closes) || closes.length < slow + signal) return null;
  const emaFastArr = [];
  const emaSlowArr = [];
  let emaFastVal = closes.slice(0, fast).reduce((a, b) => a + b, 0) / fast;
  let emaSlowVal = closes.slice(0, slow).reduce((a, b) => a + b, 0) / slow;

  for (let i = fast; i < closes.length; i++) {
    emaFastVal = closes[i] * (2 / (fast + 1)) + emaFastVal * (1 - 2 / (fast + 1));
    emaFastArr.push(emaFastVal);
  }
  for (let i = slow; i < closes.length; i++) {
    emaSlowVal = closes[i] * (2 / (slow + 1)) + emaSlowVal * (1 - 2 / (slow + 1));
    emaSlowArr.push(emaSlowVal);
  }

  const offset = emaFastArr.length - emaSlowArr.length;
  const macdArr = emaSlowArr.map((v, i) => emaFastArr[i + offset] - v);
  const macd = macdArr[macdArr.length - 1];

  let emaSig = macdArr.slice(0, signal).reduce((a, b) => a + b, 0) / signal;
  for (let i = signal; i < macdArr.length; i++) {
    emaSig = macdArr[i] * (2 / (signal + 1)) + emaSig * (1 - 2 / (signal + 1));
  }
  const hist = macd - emaSig;
  return { macd, signal: emaSig, hist };
}

function calcStoch(bars, kPeriod = 14) {
  if (!Array.isArray(bars) || bars.length < kPeriod) return null;
  const slice = bars.slice(-kPeriod);
  const highs = slice.map((b) => b.h);
  const lows = slice.map((b) => b.l);
  const closes = slice.map((b) => b.c);
  const highest = Math.max(...highs);
  const lowest = Math.min(...lows);
  const lastClose = closes[closes.length - 1];
  const denom = highest - lowest || 1e-9;
  const k = ((lastClose - lowest) / denom) * 100;
  const d = k;
  return { k, d };
}

function calcBB(closes, period = 20, stdMult = 2) {
  if (!Array.isArray(closes) || closes.length < period) return null;
  const slice = closes.slice(-period);
  const ma = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - ma, 2), 0) / period;
  const std = Math.sqrt(variance);
  const upper = ma + stdMult * std;
  const lower = ma - stdMult * std;
  const widthPct = (upper - lower) / (ma || 1e-9) * 100;
  return { ma, upper, lower, widthPct };
}

function classifyRegime(atrPct, bbWidth) {
  if (atrPct == null || bbWidth == null) return 'غير محدّد';
  if (atrPct > 0.5 && bbWidth > 5) return 'Trend / Volatile';
  if (atrPct < 0.25 && bbWidth < 3) return 'Range / Calm';
  if (atrPct > 0.8) return 'High Volatility';
  return 'Mixed / Normal';
}

// ---------- Pivot ----------

function updatePivot(bars) {
  const pivotTable = $('#pivotTable tbody');
  const pivotPrice = $('#pivotPrice');
  if (!pivotTable || !pivotPrice || !Array.isArray(bars) || !bars.length) return;

  const last = bars[bars.length - 1];
  const H = last.h;
  const L = last.l;
  const C = last.c;
  const P = (H + L + C) / 3;
  const R1 = 2 * P - L;
  const S1 = 2 * P - H;
  const R2 = P + (H - L);
  const S2 = P - (H - L);
  const R3 = H + 2 * (P - L);
  const S3 = L - 2 * (H - P);

  const levels = [
    { label: 'R3', value: R3, type: 'res' },
    { label: 'R2', value: R2, type: 'res' },
    { label: 'R1', value: R1, type: 'res' },
    { label: 'P',  value: P,  type: 'pivot' },
    { label: 'S1', value: S1, type: 'sup' },
    { label: 'S2', value: S2, type: 'sup' },
    { label: 'S3', value: S3, type: 'sup' },
  ];

  const price = last.c;
  pivotTable.innerHTML = '';
  for (const lvl of levels) {
    const diff = ((lvl.value - price) / (price || 1e-9)) * 100;
    const tr = document.createElement('tr');
    tr.className = lvl.type;
    tr.innerHTML = `
      <td>${lvl.label}</td>
      <td>${lvl.value.toFixed(2)}</td>
      <td>${diff.toFixed(2)}%</td>
      <td>${
        lvl.type === 'pivot'
          ? 'النقطة المحورية لليوم'
          : lvl.type === 'res'
          ? 'منطقة مقاومة محتملة'
          : 'منطقة دعم محتملة'
      }</td>
    `;
    pivotTable.appendChild(tr);
  }

  pivotPrice.textContent = `آخر سعر مستخدم لحساب Pivot: ${price.toFixed(2)}`;
}

// ---------- Stats UI ----------

function setText(id, val, suffix = '') {
  const el = document.getElementById(id);
  if (!el) return;
  if (val == null || Number.isNaN(val)) {
    el.textContent = '—';
  } else {
    el.textContent = suffix ? `${val}${suffix}` : String(val);
  }
}

// *** النسخة المعدّلة من updateStats: الحد الأدنى 15 شمعة ***
function updateStats(bars) {
  // من هلق وطالع إذا في 15 شمعة أو أكتر منبلّش نحسب المؤشرات
  if (!Array.isArray(bars) || bars.length < 15) {
    setText('atrVal', null);
    setText('atrPct', null);
    setText('bbWidth', null);
    setText('rsiVal', null);
    setText('macdVal', null);
    setText('stochVal', null);
    const regimeBadge = $('#regimeBadge');
    if (regimeBadge) regimeBadge.textContent = 'لا يوجد بيانات كافية';
    const signalBadge = $('#signalBadge');
    const signalText = $('#signalText');
    if (signalBadge && signalText) {
      signalBadge.classList.remove('sell', 'flat');
      signalText.textContent = 'لا إشارة واضحة بعد';
    }
    return;
  }

  const closes = bars.map((b) => b.c);

  const atr = calcATR(bars, 14);
  const lastClose = closes[closes.length - 1];
  const atrPct = atr != null ? (atr / (lastClose || 1e-9)) * 100 : null;

  const rsi = calcRSI(closes, 14);
  const macdRes = calcMACD(closes, 12, 26, 9);
  const stoch = calcStoch(bars, 14, 3);
  const bb = calcBB(closes, 20, 2);

  setText('atrVal', atr != null ? atr.toFixed(2) : null);
  setText('atrPct', atrPct != null ? atrPct.toFixed(2) : null, '%');
  setText('bbWidth', bb?.widthPct != null ? bb.widthPct.toFixed(2) : null, '%');
  setText('rsiVal', rsi != null ? rsi.toFixed(1) : null);
  setText('macdVal', macdRes ? macdRes.macd.toFixed(3) : null);
  setText('stochVal', stoch ? stoch.k.toFixed(1) : null);

  const regime = classifyRegime(atrPct, bb?.widthPct);
  const regimeBadge = $('#regimeBadge');
  if (regimeBadge) regimeBadge.textContent = regime;

  const signalBadge = $('#signalBadge');
  const signalText = $('#signalText');
  if (signalBadge && signalText) {
    signalBadge.classList.remove('sell', 'flat');
    if (rsi != null && rsi < 30) {
      signalBadge.classList.add('flat');
      signalText.textContent = 'Oversold (ممكن ارتداد صعودي)';
    } else if (rsi != null && rsi > 70) {
      signalBadge.classList.add('sell');
      signalText.textContent = 'Overbought (ممكن هبوط/تصحيح)';
    } else {
      signalBadge.classList.add('flat');
      signalText.textContent = 'لا إشارة قوية – نطاق عادي';
    }
  }

  updatePivot(bars);
}

// ---------- Fetch bars & CSV ----------

async function fetchBars(tf, limit) {
  const base = getBase();
  const url = `${base}/bars?tf=${encodeURIComponent(tf)}&limit=${limit}`;
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (!Array.isArray(j)) return [];
  return j;
}

let lastBarsState = { tf: '5m', limit: 1200, bars: [] };

async function loadAndRenderBars(tf, limit) {
  const logEl = $('#log');
  function log(msg) {
    if (!logEl) return;
    logEl.textContent += msg + '\n';
  }

  try {
    if (logEl && $('#dbgToggle')?.checked) logEl.style.display = 'block';

    log('Fetching bars…');
    const bars = await fetchBars(tf, limit);
    log(`Received ${bars.length} bars`);

    lastBarsState = { tf, limit, bars };

    const ctx = ensureMainChart();
    if (ctx && ctx.series) {
      const data = barsToCandleData(bars);
      ctx.series.setData(data);
      if (ctx.chart && data.length) {
        ctx.chart.timeScale().fitContent();
      }
    }

    updateStats(bars);
  } catch (e) {
    console.warn('[GSX] loadAndRenderBars error:', e);
    if (logEl) {
      logEl.textContent += 'ERROR: ' + e.message + '\n';
      logEl.style.display = 'block';
    }
    alert('تعذّر جلب الشموع من الووركر.');
  }
}

function exportCSV() {
  const { tf, bars } = lastBarsState;
  if (!Array.isArray(bars) || !bars.length) {
    alert('لا توجد شموع حالياً للتصدير. استعمل "جلب الشموع" أولاً.');
    return;
  }
  const rows = [
    'time,open,high,low,close,volume',
    ...bars.map((b) => {
      const t = b.t ?? b.time ?? b.ts ?? Date.now();
      const iso = new Date(t).toISOString();
      const o = b.o ?? '';
      const h = b.h ?? '';
      const l = b.l ?? '';
      const c = b.c ?? '';
      const v = b.v ?? b.volume ?? '';
      return `${iso},${o},${h},${l},${c},${v}`;
    }),
  ];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const tfStr = tf.replace(/[^a-z0-9]/gi, '_');
  a.href = url;
  a.download = `gsx_${tfStr}_bars.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- Init ----------

function init() {
  const baseEl = $('#base');
  if (baseEl) {
    baseEl.value = getSavedBase() || DEFAULT_BASE;
  }

  setupTabs();
  const tfCtl = setupTFBar(async (tf) => {
    await loadAndRenderBars(tf, 1200);
  });

  const saveBtn = $('#saveBase');
  if (saveBtn && baseEl) {
    saveBtn.addEventListener('click', () => {
      const b = setSavedBase(baseEl.value);
      alert('تم حفظ رابط الووركر:\n' + b);
      // لما يغيّر الرابط منخلي السعر والشموع يرجعوا يتحدّثوا من الـ base الجديد
      priceTick();
      const tf = tfCtl ? tfCtl.getCurrentTF() : '5m';
      loadAndRenderBars(tf, 1200);
    });
  }

  ensureMainChart();

  const btnFetch = $('#btnFetchBars');
  if (btnFetch) {
    btnFetch.addEventListener('click', async () => {
      const tf = tfCtl ? tfCtl.getCurrentTF() : '5m';
      await loadAndRenderBars(tf, 1200);
    });
  }

  const btnCSV = $('#btnExportCSV');
  if (btnCSV) {
    btnCSV.addEventListener('click', exportCSV);
  }

  const btnReload = $('#btnReload');
  if (btnReload) {
    btnReload.addEventListener('click', () => {
      location.reload();
    });
  }

  const dbgToggle = $('#dbgToggle');
  const logEl = $('#log');
  if (dbgToggle && logEl) {
    dbgToggle.addEventListener('change', () => {
      logEl.style.display = dbgToggle.checked ? 'block' : 'none';
      if (!dbgToggle.checked) logEl.textContent = '';
    });
  }

  // live price
  startPricePolling();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopPricePolling();
    else startPricePolling();
  });

  // أول تحميل للشموع
  const tf = tfCtl ? tfCtl.getCurrentTF() : '5m';
  loadAndRenderBars(tf, 1200);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
