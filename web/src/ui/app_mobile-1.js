// GoldSignalsX • Frontend
// يعتمد على worker: /price و /bars

const DEFAULT_WORKER_URL =
  "https://goldsignalsx-worker.samer-mourtada.workers.dev";

const tfSelect = document.getElementById("tf-select");
const limitInput = document.getElementById("limit-input");
const workerInput = document.getElementById("worker-input");

const btnPrice = document.getElementById("btn-price");
const btnBars = document.getElementById("btn-bars");
const statusLine = document.getElementById("status-line");

const emaInfo = document.getElementById("ema-info");
const rsiInfo = document.getElementById("rsi-info");
const stochInfo = document.getElementById("stoch-info");
const macdInfo = document.getElementById("macd-info");
const patternLast = document.getElementById("pattern-last");
const patternExtra = document.getElementById("pattern-extra");
const adviceBadge = document.getElementById("advice-badge");

const modeGroup = document.getElementById("mode-group");
const marketGroup = document.getElementById("market-group");

let chart;
let candleSeries;
let lastBars = [];

function getWorkerUrl() {
  const raw = (workerInput.value || "").trim();
  if (!raw) return DEFAULT_WORKER_URL;
  return raw.replace(/\/+$/, "");
}

function setStatus(msg, type = "info") {
  let color = "var(--text-muted)";
  if (type === "ok") color = "var(--success)";
  if (type === "err") color = "var(--danger)";
  statusLine.innerHTML = `<span style="color:${color}">${msg}</span>`;
  console.log("[GSX] STATUS:", msg);
}

// ---------- Helpers for indicators ----------

function ema(values, period) {
  if (!values.length || period <= 1) return [];
  const k = 2 / (period + 1);
  const out = [];
  let prev = values[0];
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    const v = values[i] * k + prev * (1 - k);
    out.push(v);
    prev = v;
  }
  return out;
}

function rsi(values, period = 14) {
  if (values.length <= period) return [];
  const gains = [];
  const losses = [];
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
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

function stoch(values, high, low, period = 14) {
  if (values.length < period) return [];
  const out = [];
  for (let i = period - 1; i < values.length; i++) {
    let h = -Infinity;
    let l = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (high[j] > h) h = high[j];
      if (low[j] < l) l = low[j];
    }
    const k = ((values[i] - l) / (h - l || 1)) * 100;
    out.push(k);
  }
  return out;
}

function macd(values, fast = 12, slow = 26, signal = 9) {
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  const len = Math.min(fastEma.length, slowEma.length);
  const macdLine = [];
  for (let i = 0; i < len; i++) macdLine.push(fastEma[i] - slowEma[i]);
  const signalLine = ema(macdLine, signal);
  const hist = macdLine.map((v, i) => v - (signalLine[i] ?? 0));
  return { macdLine, signalLine, hist };
}

// ---------- Candlestick pattern detection (بسيط) ----------

function detectPattern(bars) {
  if (!bars || bars.length < 2) return { name: "لا يوجد", detail: "" };

  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];

  const body = Math.abs(last.c - last.o);
  const range = last.h - last.l || 1;
  const upper = last.h - Math.max(last.o, last.c);
  const lower = Math.min(last.o, last.c) - last.l;

  const isBull = last.c > last.o;
  const isBear = last.o > last.c;

  // Hammer
  if (body / range < 0.3 && lower / range > 0.5 && upper / range < 0.1) {
    return { name: "Hammer (مطرقة)", detail: "إشارة انعكاس صعود محتملة." };
  }

  // Shooting Star
  if (body / range < 0.3 && upper / range > 0.5 && lower / range < 0.1) {
    return { name: "Shooting Star (نجم ساقط)", detail: "إشارة انعكاس هبوط محتملة." };
  }

  // Bullish Engulfing
  if (
    prev.o > prev.c &&
    isBull &&
    last.c > prev.o &&
    last.o < prev.c
  ) {
    return {
      name: "Bullish Engulfing (ابتلاع شرائي)",
      detail: "تقوي احتمال الصعود على المدى القصير.",
    };
  }

  // Bearish Engulfing
  if (
    prev.c > prev.o &&
    isBear &&
    last.o > prev.c &&
    last.c < prev.o
  ) {
    return {
      name: "Bearish Engulfing (ابتلاع بيعي)",
      detail: "تقوي احتمال الهبوط على المدى القصير.",
    };
  }

  return { name: "لا يوجد نمط واضح", detail: "" };
}

// ---------- Chart handling ----------

function ensureChart() {
  if (chart) return;
  const root = document.getElementById("chart-root");
  chart = LightweightCharts.createChart(root, {
    layout: {
      background: { type: "Solid", color: "#020617" },
      textColor: "#e5e7eb",
    },
    grid: {
      vertLines: { color: "#111827" },
      horzLines: { color: "#111827" },
    },
    timeScale: {
      borderColor: "#374151",
      timeVisible: true,
      secondsVisible: false,
    },
    rightPriceScale: {
      borderColor: "#374151",
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
    },
  });

  candleSeries = chart.addCandlestickSeries({
    upColor: "#22c55e",
    borderUpColor: "#22c55e",
    wickUpColor: "#22c55e",
    downColor: "#ef4444",
    borderDownColor: "#ef4444",
    wickDownColor: "#ef4444",
  });

  window.addEventListener("resize", () => {
    const { width, height } = root.getBoundingClientRect();
    chart.applyOptions({ width, height });
  });

  const { width, height } = root.getBoundingClientRect();
  chart.applyOptions({ width, height });
}

function updateIndicators(bars) {
  if (!bars || !bars.length) {
    emaInfo.textContent = rsiInfo.textContent =
      stochInfo.textContent = macdInfo.textContent = "—";
    patternLast.textContent = "—";
    patternExtra.textContent = "";
    adviceBadge.textContent = "—";
    adviceBadge.className = "badge";
    return;
  }

  const closes = bars.map((b) => b.c);
  const highs = bars.map((b) => b.h);
  const lows = bars.map((b) => b.l);

  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const lastEma20 = ema20[ema20.length - 1];
  const lastEma50 = ema50[ema50.length - 1];

  const rsiArr = rsi(closes, 14);
  const lastRsi = rsiArr[rsiArr.length - 1];

  const stochArr = stoch(closes, highs, lows, 14);
  const lastStoch = stochArr[stochArr.length - 1];

  const macdObj = macd(closes, 12, 26, 9);
  const lastMacd = macdObj.macdLine[macdObj.macdLine.length - 1];
  const lastSig = macdObj.signalLine[macdObj.signalLine.length - 1];

  emaInfo.textContent = `EMA20: ${lastEma20?.toFixed(1) ?? "—"} / EMA50: ${
    lastEma50?.toFixed(1) ?? "—"
  }`;

  if (Number.isFinite(lastRsi)) {
    rsiInfo.textContent = `${lastRsi.toFixed(1)} ${
      lastRsi > 70 ? "(تشبع شراء)" : lastRsi < 30 ? "(تشبع بيع)" : ""
    }`;
  } else rsiInfo.textContent = "—";

  if (Number.isFinite(lastStoch)) {
    stochInfo.textContent = `${lastStoch.toFixed(1)} ${
      lastStoch > 80 ? "(تشبع شراء)" : lastStoch < 20 ? "(تشبع بيع)" : ""
    }`;
  } else stochInfo.textContent = "—";

  if (Number.isFinite(lastMacd) && Number.isFinite(lastSig)) {
    macdInfo.textContent = `MACD: ${lastMacd.toFixed(
      3
    )}, Signal: ${lastSig.toFixed(3)}`;
  } else macdInfo.textContent = "—";

  const pattern = detectPattern(bars);
  patternLast.textContent = pattern.name;
  patternExtra.textContent = pattern.detail || "";

  // Simple advice
  const last = bars[bars.length - 1];
  const mode = modeGroup.querySelector(".pill.active")?.dataset.mode || "fast";

  let advice = "مراقبة فقط";
  let type = "neutral";

  if (
    Number.isFinite(lastRsi) &&
    Number.isFinite(lastEma20) &&
    Number.isFinite(lastEma50)
  ) {
    if (
      last.c > lastEma20 &&
      lastEma20 > lastEma50 &&
      lastRsi < 70 &&
      pattern.name.includes("Bullish")
    ) {
      advice = mode === "cautious" ? "شراء جزئي" : "فرصة شراء";
      type = "good";
    } else if (
      last.c < lastEma20 &&
      lastEma20 < lastEma50 &&
      lastRsi > 30 &&
      pattern.name.includes("Bearish")
    ) {
      advice = mode === "cautious" ? "بيع جزئي" : "فرصة بيع";
      type = "bad";
    }
  }

  adviceBadge.textContent = advice;
  adviceBadge.className =
    "badge " + (type === "good" ? "good" : type === "bad" ? "bad" : "");
}

// ---------- Event handlers ----------

btnPrice.addEventListener("click", async () => {
  const base = getWorkerUrl();
  setStatus("جارِ جلب السعر الحي...", "info");
  try {
    const r = await fetch(`${base}/price`, { cache: "no-store" });
    if (!r.ok) throw new Error(r.status + " " + r.statusText);
    const j = await r.json();
    if (!j.ok || !Number.isFinite(j.price)) {
      throw new Error("رد غير صالح من /price");
    }
    const dt = new Date(j.ts || Date.now());
    const timeStr = dt.toLocaleTimeString("en-GB", { hour12: false });
    setStatus(
      `السعر الحي: <strong>${j.price}</strong> (المصدر: ${
        j.source || "؟"
      } في ${timeStr})`,
      "ok"
    );
  } catch (err) {
    console.error(err);
    setStatus("فشل جلب السعر الحي: " + err.message, "err");
  }
});

btnBars.addEventListener("click", async () => {
  const base = getWorkerUrl();
  const tf = tfSelect.value || "1m";
  const limit = Number(limitInput.value || "800") || 800;

  setStatus(`جارِ جلب الشموع (${tf}, limit=${limit})...`, "info");

  try {
    const url = `${base}/bars?tf=${encodeURIComponent(
      tf
    )}&limit=${encodeURIComponent(limit)}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(r.status + " " + r.statusText);
    const data = await r.json();
    if (!Array.isArray(data) || !data.length) {
      throw new Error("لا توجد شموع مرجعة من /bars");
    }

    lastBars = data.map((b) => ({
      t: b.t,
      o: b.o,
      h: b.h,
      l: b.l,
      c: b.c,
      v: b.v,
    }));

    ensureChart();

    const chartData = lastBars.map((b) => ({
      time: Math.round(b.t / 1000), // worker يعيد ms
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
    }));

    candleSeries.setData(chartData);

    // بعض العلامات على الأنماط
    const pattern = detectPattern(lastBars);
    const markers = [];
    if (pattern.name && !pattern.name.startsWith("لا يوجد")) {
      const last = lastBars[lastBars.length - 1];
      markers.push({
        time: Math.round(last.t / 1000),
        position:
          pattern.name.includes("Bearish") || pattern.name.includes("Star")
            ? "aboveBar"
            : "belowBar",
        color: pattern.name.includes("Bearish") ? "#ef4444" : "#22c55e",
        shape: "arrowDown",
        text: pattern.name.replace(/\(.+?\)/, "").trim(),
      });
    }
    if (markers.length) candleSeries.setMarkers(markers);

    updateIndicators(lastBars);

    const first = new Date(lastBars[0].t);
    const last = new Date(lastBars[lastBars.length - 1].t);
    setStatus(
      `تم جلب <strong>${lastBars.length}</strong> شمعة من ${first.toISOString()} إلى ${last.toISOString()}.`,
      "ok"
    );
  } catch (err) {
    console.error(err);
    setStatus("فشل جلب الشموع أو رسم الشارت: " + err.message, "err");
    updateIndicators([]);
  }
});

// اختيار المود/حالة السوق
function setupPills(group) {
  group.addEventListener("click", (e) => {
    const btn = e.target.closest(".pill");
    if (!btn) return;
    group.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
  });
}
setupPills(modeGroup);
setupPills(marketGroup);

// قيمة ابتدائية
workerInput.value = DEFAULT_WORKER_URL;
setStatus("جاهز. اختر TF ثم جلب الشموع أو تحديث السعر الحي.", "info");
