// GoldSignalsX – Mobile front logic (بسيط وواضح)

const GSX_DEFAULT_BASE = 'https://goldsignalsx-worker.samer-mourtada.workers.dev';

// ------------------------- Helpers -------------------------

function getSavedBase() {
  return (localStorage.getItem('GSX_BASE_URL') || '').trim();
}

function setSavedBase(v) {
  const base = (v || '').trim();
  if (base) {
    localStorage.setItem('GSX_BASE_URL', base);
  } else {
    localStorage.removeItem('GSX_BASE_URL');
  }
}

function getBase() {
  return getSavedBase() || GSX_DEFAULT_BASE;
}

function $(sel) {
  return document.querySelector(sel);
}

// ------------------------- Price polling -------------------------

async function fetchPriceOnce() {
  const base = getBase().replace(/\/+$/, '');
  const urls = [
    `${base}/price`,
    `${base}/api/price`
  ];

  let lastErr = null;

  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: 'no-store' });
      if (!r.ok) {
        lastErr = new Error('HTTP ' + r.status);
        continue;
      }
      const j = await r.json();
      // نحاول نقرأ السعر من أكتر من شكل
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
    priceEl.style.color = '#aaa';
  } else {
    priceEl.textContent = (Math.round(meta.price * 1000) / 1000).toString();
    priceEl.style.color = '#0f0';
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
    } catch (e) {
      // ignore
    }
  }
}

let __priceTimer = null;

async function priceTick() {
  const meta = await fetchPriceOnce();
  updatePriceUI(meta);
}

function startPricePolling() {
  if (__priceTimer) return;
  priceTick();
  __priceTimer = setInterval(priceTick, 1000);
}

function stopPricePolling() {
  if (__priceTimer) {
    clearInterval(__priceTimer);
    __priceTimer = null;
  }
}

// ------------------------- Bars & Chart -------------------------

let gsxChart = null;
let gsxSeries = null;

function ensureChart() {
  const el = $('#chart');
  if (!el) {
    console.warn('[GSX] #chart not found');
    return null;
  }
  if (gsxChart && gsxSeries) return { chart: gsxChart, series: gsxSeries };

  gsxChart = LightweightCharts.createChart(el, {
    height: 320,
    layout: {
      background: { type: 'solid', color: '#0b0d12' },
      textColor: '#e5e7eb'
    },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: true, borderColor: '#1f2937' },
    grid: {
      vertLines: { color: '#111827' },
      horzLines: { color: '#111827' }
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal
    }
  });

  gsxSeries = gsxChart.addCandlestickSeries({
    upColor: '#22c55e',
    downColor: '#ef4444',
    borderUpColor: '#22c55e',
    borderDownColor: '#ef4444',
    wickUpColor: '#22c55e',
    wickDownColor: '#ef4444'
  });

  window.gsx = window.gsx || {};
  window.gsx.lw = { chart: gsxChart, series: gsxSeries };

  return { chart: gsxChart, series: gsxSeries };
}

function toCandleData(bars) {
  if (!Array.isArray(bars)) return [];
  return bars
    .filter(
      (b) =>
        b &&
        Number.isFinite(b.o) &&
        Number.isFinite(b.h) &&
        Number.isFinite(b.l) &&
        Number.isFinite(b.c) &&
        (b.t != null || b.time != null || b.ts != null)
    )
    .map((b) => {
      const t = b.t ?? b.time ?? b.ts ?? Date.now();
      return {
        time: Math.floor(t / 1000),
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c
      };
    });
}

async function fetchBars(tf, limit) {
  const base = getBase().replace(/\/+$/, '');
  const url = `${base}/bars?tf=${encodeURIComponent(tf)}&limit=${limit}`;
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) {
    throw new Error('bars HTTP ' + r.status);
  }
  const j = await r.json();
  if (!Array.isArray(j)) return [];
  return j;
}

async function loadBarsOnce() {
  try {
    // TF: من الزر الفعّال أو 1m
    const tfBtn =
      document.querySelector('button[data-tf].active') ||
      document.querySelector('button[data-tf="1m"]') ||
      document.querySelector('button[data-tf]');
    const tf = tfBtn ? tfBtn.getAttribute('data-tf') || '1m' : '1m';

    // Limit: من input#limit
    const limEl = $('#limit') || $('#limitInput');
    const limit = Number(limEl?.value || 1200) || 1200;

    const bars = await fetchBars(tf, limit);

    const ctx = ensureChart();
    if (!ctx || !ctx.series) return;

    const data = toCandleData(bars);
    ctx.series.setData(data);

    // نعمل fit للشارت
    if (ctx.chart && data.length > 0) {
      ctx.chart.timeScale().fitContent();
    }

    // نخزّن آخر مجموعة شموع للإستخدام (مثلاً CSV)
    window.__GSX_LAST_BARS__ = { tf, limit, bars };
    console.log('[GSX] bars loaded:', tf, 'count=', data.length);
  } catch (e) {
    console.warn('[GSX] loadBarsOnce error:', e);
    alert('تعذّر جلب الشموع من الووركر.');
  }
}

// ------------------------- CSV Export -------------------------

function exportBarsCSV() {
  const last = window.__GSX_LAST_BARS__;
  if (!last || !Array.isArray(last.bars) || last.bars.length === 0) {
    alert('لا توجد شموع حالياً للتصدير. استعمل "جلب الشموع" أولاً.');
    return;
  }

  const rows = [
    'time,open,high,low,close,volume',
    ...last.bars.map((b) => {
      const t = b.t ?? b.time ?? b.ts ?? Date.now();
      const iso = new Date(t).toISOString();
      const o = b.o ?? '';
      const h = b.h ?? '';
      const l = b.l ?? '';
      const c = b.c ?? '';
      const v = b.v ?? b.volume ?? '';
      return `${iso},${o},${h},${l},${c},${v}`;
    })
  ];

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const tfStr = (window.__GSX_LAST_BARS__?.tf || 'tf').replace(/[^a-z0-9]/gi, '_');
  a.download = `gsx_${tfStr}_bars.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ------------------------- Wiring / DOM -------------------------

function setupBaseUI() {
  const baseInput = $('#base');
  const saveBtn = $('#saveBase');

  if (baseInput) {
    const saved = getSavedBase();
    baseInput.value = saved || GSX_DEFAULT_BASE;
  }

  if (saveBtn && baseInput) {
    saveBtn.addEventListener('click', () => {
      setSavedBase(baseInput.value);
      alert('تم حفظ رابط الووركر.');
    });
  }
}

function setupTFBar() {
  const bar = $('#tfBar');
  if (!bar) return;

  bar.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-tf]');
    if (!btn) return;
    bar.querySelectorAll('button[data-tf]').forEach((b) =>
      b.classList.remove('active')
    );
    btn.classList.add('active');
    // لما يغيّر التايم فريم، نعيد جلب الشموع
    loadBarsOnce();
  });

  // نعلّم أول زر كـ active إذا ما في ولا واحد
  const anyActive = bar.querySelector('button[data-tf].active');
  if (!anyActive) {
    const first = bar.querySelector('button[data-tf]');
    if (first) first.classList.add('active');
  }
}

function setupButtons() {
  const btnBars = $('#btnBars') || $('#btnFetch');
  if (btnBars && !btnBars.__gsxBound) {
    btnBars.__gsxBound = true;
    btnBars.addEventListener('click', loadBarsOnce);
  }

  const btnCSV = $('#btnCSV');
  if (btnCSV && !btnCSV.__gsxBound) {
    btnCSV.__gsxBound = true;
    btnCSV.addEventListener('click', exportBarsCSV);
  }
}

// ------------------------- Init -------------------------

function initGSXMobile() {
  setupBaseUI();
  setupTFBar();
  setupButtons();
  ensureChart();
  startPricePolling();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopPricePolling();
    else startPricePolling();
  });

  console.log('[GSX] mobile app initialized');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGSXMobile);
} else {
  initGSXMobile();
}
