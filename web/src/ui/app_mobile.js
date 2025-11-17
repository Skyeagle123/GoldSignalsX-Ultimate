// GoldSignalsX – Ultimate Mobile Logic
(function(){
  const $ = s => document.querySelector(s);
  const LS_KEY = "GSX_MOBILE_STATE";

  const workerInput = $("#worker-url");
  const tfSelect    = $("#tf");
  const limitInput  = $("#limit");
  const btnSave     = $("#btn-save");
  const btnPrice    = $("#btn-price");
  const btnBars     = $("#btn-bars");
  const statusEl    = $("#status");
  const logEl       = $("#log");

  const modeSeg     = $("#mode-seg");
  const marketSeg   = $("#market-seg");

  const rsiValEl    = $("#rsi-value");
  const rsiTrendEl  = $("#rsi-trend");
  const stochValEl  = $("#stoch-value");
  const stochTrendEl= $("#stoch-trend");
  const macdValEl   = $("#macd-value");
  const macdTrendEl = $("#macd-trend");
  const emaValEl    = $("#ema-value");
  const emaTrendEl  = $("#ema-trend");
  const adviceEl    = $("#advice");
  const candleEl    = $("#candle-pattern");

  const chartContainer = $("#chart");

  let chart, candleSeries;
  let state = {
    worker: "https://goldsignalsx-worker.samer_mourtada.workers.dev",
    tf: "1m",
    limit: 800,
    mode: "fast",      // fast / safe / smart
    market: "auto"     // auto / trend / range / flat
  };

  // ===== load state from localStorage =====
  try{
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    state = { ...state, ...saved };
  }catch{}

  workerInput.value = state.worker;
  tfSelect.value    = state.tf;
  limitInput.value  = state.limit;

  // init seg buttons
  [...modeSeg.querySelectorAll("button")].forEach(b=>{
    b.classList.toggle("active", b.dataset.mode === state.mode);
    b.addEventListener("click", ()=>{
      [...modeSeg.children].forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      state.mode = b.dataset.mode;
      saveState();
      updateAdviceLast(); // إعادة تقييم
    });
  });

  [...marketSeg.querySelectorAll("button")].forEach(b=>{
    b.classList.toggle("active", b.dataset.market === state.market);
    b.addEventListener("click", ()=>{
      [...marketSeg.children].forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      state.market = b.dataset.market;
      saveState();
      updateAdviceLast();
    });
  });

  function saveState(){
    state.worker = workerInput.value.trim();
    state.tf     = tfSelect.value;
    state.limit  = Number(limitInput.value)||800;
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }

  function setStatus(msg){
    statusEl.textContent = msg;
  }

  function log(...args){
    const line = args.map(x => typeof x === "string" ? x : JSON.stringify(x)).join(" ");
    logEl.textContent = (line + "\n" + logEl.textContent).slice(0,6000);
    console.log("[GSX]", ...args);
  }

  function okURL(u){
    try{
      const x = new URL(u);
      return /^https?:/i.test(x.protocol);
    }catch{ return false; }
  }

  // ===== chart init =====
  function ensureChart(){
    if (chart) return;
    chart = LightweightCharts.createChart(chartContainer,{
      layout:{ background:{ color:"#101822" }, textColor:"#dde7f5" },
      grid:{
        vertLines:{ color:"#1c2a3a" },
        horzLines:{ color:"#1c2a3a" }
      },
      rightPriceScale:{ borderColor:"#1c2a3a" },
      timeScale:{
        borderColor:"#1c2a3a",
        timeVisible:true,
        secondsVisible:false
      }
    });
    candleSeries = chart.addCandlestickSeries({
      upColor:'#1fd18a',
      downColor:'#ff5c6c',
      borderVisible:false,
      wickUpColor:'#1fd18a',
      wickDownColor:'#ff5c6c'
    });
  }

  // ===== PRICE =====
  async function fetchPrice(){
    const base = workerInput.value.trim();
    if (!okURL(base)){ alert("الرجاء إدخال Worker URL صحيح"); return; }
    saveState();

    const url = base.replace(/\/+$/,"") + "/price";
    btnPrice.disabled = true;
    setStatus("جلب السعر الحي…");

    try{
      const r = await fetch(url,{ headers:{accept:"application/json"}, cache:"no-store" });
      const j = await r.json();
      if (!r.ok || !j || !j.ok){
        throw new Error("bad response " + JSON.stringify(j));
      }
      const price = Number(j.price);
      const ts    = Number(j.ts || Date.now());
      const src   = j.source || "unknown";
      if (!Number.isFinite(price)) throw new Error("no price");

      log(`💲 Price: ${price.toFixed(2)} (src=${src}) @ ${new Date(ts).toLocaleString()}`);
      setStatus("تم تحديث السعر.");

    }catch(e){
      log("price error:", String(e.message||e));
      setStatus("خطأ في جلب السعر.");
      alert("خطأ في جلب السعر الحي");
    }finally{
      btnPrice.disabled = false;
    }
  }

  // ===== BARS + INDICATORS =====
  let lastIndicators = null;

  async function fetchBars(){
    const base = workerInput.value.trim();
    if (!okURL(base)){ alert("Worker URL غير صالح"); return; }
    saveState();

    const tf    = tfSelect.value;
    const limit = Math.max(50, Math.min(5000, Number(limitInput.value)||800));
    const url   = base.replace(/\/+$/,"") + `/bars?tf=${encodeURIComponent(tf)}&limit=${limit}`;

    btnBars.disabled = true;
    setStatus(`جلب الشموع (${tf})…`);

    try{
      const r = await fetch(url,{ headers:{accept:"application/json"}, cache:"no-store" });
      const raw = await r.json();
      if (!Array.isArray(raw)) throw new Error("bars payload not array");

      const rows = raw
        .map(b => ({
          t: Number(b.t),
          o: Number(b.o),
          h: Number(b.h),
          l: Number(b.l),
          c: Number(b.c),
          v: Number(b.v||0)
        }))
        .filter(b =>
          Number.isFinite(b.t) && Number.isFinite(b.o) &&
          Number.isFinite(b.h) && Number.isFinite(b.l) &&
          Number.isFinite(b.c)
        );

      if (!rows.length){
        candleSeries && candleSeries.setData([]);
        setStatus("لا يوجد بيانات شموع.");
        log("bars empty for tf", tf);
        alert("لا توجد شموع (قد يكون D1 فارغ).");
        return;
      }

      ensureChart();
      const candles = rows.map(b=>({
        time: Math.round(b.t/1000),
        open: b.o,
        high: b.h,
        low : b.l,
        close:b.c
      }));
      candleSeries.setData(candles);
      chart.timeScale().fitContent();

      // حساب المؤشرات
      lastIndicators = computeIndicators(rows);
      updateIndicatorsUI(lastIndicators);
      updateAdviceLast();

      // كشف نمط الشموع
      const pattern = detectCandlePattern(rows);
      updateCandlePattern(pattern);

      setStatus(`تم رسم ${rows.length} شمعة وتحديث المؤشرات.`);
      log("bars ok:", {tf, n:rows.length});

    }catch(e){
      log("bars error:", String(e.message||e));
      setStatus("خطأ في جلب الشموع.");
      alert("خطأ في جلب الشموع من /bars");
    }finally{
      btnBars.disabled = false;
    }
  }

  // ===== INDICATORS (EMA / RSI / STOCH / MACD) =====
  function ema(values, period){
    const out = [];
    let k = 2 / (period + 1);
    let emaPrev = null;
    for (let i=0;i<values.length;i++){
      const v = values[i];
      if (!Number.isFinite(v)){ out.push(null); continue; }
      if (emaPrev === null){
        emaPrev = v; // أول قيمة
      }else{
        emaPrev = v * k + emaPrev * (1 - k);
      }
      out.push(emaPrev);
    }
    return out;
  }

  function rsi(values, period){
    const out = [];
    let avgGain = 0, avgLoss = 0;
    for (let i=0;i<values.length;i++){
      if (i===0){ out.push(null); continue; }
      const change = values[i] - values[i-1];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;

      if (i <= period){
        // تجميع أولي
        avgGain += gain;
        avgLoss += loss;
        if (i === period){
          avgGain /= period;
          avgLoss /= period || 1;
          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
          out.push(100 - 100/(1+rs));
        }else{
          out.push(null);
        }
      }else{
        avgGain = (avgGain*(period-1) + gain) / period;
        avgLoss = (avgLoss*(period-1) + loss) / period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        out.push(100 - 100/(1+rs));
      }
    }
    return out;
  }

  function stoch(highs,lows,closes,period,kSlow){
    const kArr = [];
    const dArr = [];
    for (let i=0;i<closes.length;i++){
      if (i < period-1){ kArr.push(null); dArr.push(null); continue; }
      let hi = highs[i], lo = lows[i];
      for (let j=i-period+1;j<=i;j++){
        if (highs[j] > hi) hi = highs[j];
        if (lows[j]  < lo) lo = lows[j];
      }
      const c = closes[i];
      const k = hi === lo ? 50 : ((c - lo) / (hi - lo)) * 100;
      kArr.push(k);
      // %D = SMA(%K, kSlow)
      if (i < period - 1 + (kSlow-1)){ dArr.push(null); continue; }
      let sum = 0, count=0;
      for (let j=i-kSlow+1;j<=i;j++){
        if (kArr[j] == null) continue;
        sum += kArr[j];
        count++;
      }
      dArr.push(count? sum/count : null);
    }
    return { k:kArr, d:dArr };
  }

  function macd(values,fast=12,slow=26,signalP=9){
    const emaFast = ema(values, fast);
    const emaSlow = ema(values, slow);
    const line = values.map((_,i)=>{
      if (emaFast[i]==null || emaSlow[i]==null) return null;
      return emaFast[i] - emaSlow[i];
    });
    const signal = ema(line.filter(v=>v!=null), signalP);
    // align signal/hist with original indices
    const sigAligned = [];
    let idxSig = 0;
    for (let i=0;i<line.length;i++){
      if (line[i]==null){ sigAligned.push(null); }
      else{
        sigAligned.push(signal[idxSig] ?? null);
        idxSig++;
      }
    }
    const hist = line.map((v,i)=>{
      if (v==null || sigAligned[i]==null) return null;
      return v - sigAligned[i];
    });
    return { line, signal:sigAligned, hist };
  }

  function computeIndicators(rows){
    const closes = rows.map(r=>r.c);
    const highs  = rows.map(r=>r.h);
    const lows   = rows.map(r=>r.l);

    const emaFast = ema(closes, 9);
    const emaSlow = ema(closes, 21);
    const rsiArr  = rsi(closes, 14);
    const st      = stoch(highs,lows,closes,14,3);
    const mac     = macd(closes,12,26,9);

    const lastIdx = closes.length-1;

    const last = {
      close : closes[lastIdx],
      emaFast: emaFast[lastIdx],
      emaSlow: emaSlow[lastIdx],
      rsi    : rsiArr[lastIdx],
      stochK : st.k[lastIdx],
      stochD : st.d[lastIdx],
      macd   : mac.line[lastIdx],
      macdSig: mac.signal[lastIdx],
      macdHist:mac.hist[lastIdx]
    };
    return { series:{emaFast,emaSlow,rsi:rsiArr,stoch:st,macd:mac}, last };
  }

  function fmt(v,dec=2){
    if (!Number.isFinite(v)) return "—";
    return v.toFixed(dec);
  }

  function updateIndicatorsUI(ind){
    if (!ind){ 
      rsiValEl.textContent = stochValEl.textContent = macdValEl.textContent = emaValEl.textContent = "—";
      return;
    }
    const L = ind.last;

    // RSI
    rsiValEl.textContent = fmt(L.rsi);
    rsiValEl.className = "ibox-value";
    if (L.rsi > 70)      rsiValEl.classList.add("bad");
    else if (L.rsi < 30) rsiValEl.classList.add("good");
    rsiTrendEl.textContent = L.rsi>50 ? "ميل صاعد" : "ميل هابط";

    // Stoch
    stochValEl.textContent = `${fmt(L.stochK)} / ${fmt(L.stochD)}`;
    stochValEl.className = "ibox-value";
    if (L.stochK>80 && L.stochD>80) stochValEl.classList.add("bad");
    else if (L.stochK<20 && L.stochD<20) stochValEl.classList.add("good");
    stochTrendEl.textContent = L.stochK>50 ? "زخم قوي" : "زخم ضعيف";

    // MACD
    macdValEl.textContent = `${fmt(L.macd)} / ${fmt(L.macdSig)} / ${fmt(L.macdHist)}`;
    macdValEl.className = "ibox-value";
    if (L.macdHist>0) macdValEl.classList.add("good");
    else if (L.macdHist<0) macdValEl.classList.add("bad");
    macdTrendEl.textContent = L.macd>0 ? "قوة للمشترين" : "قوة للبائعين";

    // EMA
    emaValEl.textContent = `${fmt(L.emaFast)} / ${fmt(L.emaSlow)}`;
    emaValEl.className = "ibox-value";
    if (L.emaFast > L.emaSlow) emaValEl.classList.add("good");
    else if (L.emaFast < L.emaSlow) emaValEl.classList.add("bad");
    emaTrendEl.textContent = L.emaFast > L.emaSlow ? "ترند صاعد" : "ترند هابط";
  }

  // ===== Candle patterns (بسيط) =====
  function detectCandlePattern(rows){
    if (rows.length < 2) return null;
    const last  = rows[rows.length-1];
    const prev  = rows[rows.length-2];
    const body  = Math.abs(last.c - last.o);
    const range = last.h - last.l || 1;
    const upper = last.h - Math.max(last.c,last.o);
    const lower = Math.min(last.c,last.o) - last.l;

    // doji
    if (body <= range*0.15){
      return { name:"Doji", type:"neutral", desc:"تردد في السوق" };
    }
    // hammer
    if (lower > range*0.5 && upper < range*0.2 && last.c>last.o){
      return { name:"Hammer", type:"bull", desc:"إشارة انعكاس صعودي محتملة" };
    }
    // shooting star
    if (upper > range*0.5 && lower < range*0.2 && last.c<last.o){
      return { name:"Shooting Star", type:"bear", desc:"إشارة انعكاس هبوطي محتملة" };
    }
    // engulfing
    const lastBull = last.c>last.o;
    const prevBull = prev.c>prev.o;
    const lastBodyHigh = Math.max(last.c,last.o);
    const lastBodyLow  = Math.min(last.c,last.o);
    const prevBodyHigh = Math.max(prev.c,prev.o);
    const prevBodyLow  = Math.min(prev.c,prev.o);

    if (!lastBull && prevBull && lastBodyHigh<=prevBodyHigh && lastBodyLow<=prevBodyLow){
      return { name:"Bearish Engulfing", type:"bear", desc:"ابتلاع بيعي فوقي" };
    }
    if ( lastBull && !prevBull && lastBodyHigh>=prevBodyHigh && lastBodyLow>=prevBodyLow){
      return { name:"Bullish Engulfing", type:"bull", desc:"ابتلاع شرائي سفلي" };
    }
    return null;
  }

  function updateCandlePattern(p){
    candleEl.className = "";
    if (!p){
      candleEl.textContent = "لا يوجد نمط واضح";
      return;
    }
    let colorClass = "";
    if (p.type === "bull") colorClass = "good";
    else if (p.type === "bear") colorClass = "bad";
    candleEl.textContent = `${p.name} – ${p.desc}`;
    if (colorClass) candleEl.classList.add(colorClass);
  }

  // ===== Advice engine =====
  function makeAdvice(ind, mode, market){
    if (!ind) return { text:"—", mood:"neutral" };
    const L = ind.last;

    // تحديد حالة السوق آلياً لو auto
    let mk = market;
    if (mk === "auto"){
      const trending = Math.abs(L.macdHist||0) > 0.1 && Math.abs((L.emaFast||0)-(L.emaSlow||0)) > 0.3;
      const ranging  = L.rsi && L.rsi>40 && L.rsi<60;
      if (trending) mk = "trend";
      else if (ranging) mk = "range";
      else mk = "flat";
    }

    let bias = "wait";
    let reason = [];

    const emaBull = L.emaFast > L.emaSlow;
    const emaBear = L.emaFast < L.emaSlow;
    const macdBull= (L.macdHist||0) > 0;
    const macdBear= (L.macdHist||0) < 0;
    const rsiHigh = L.rsi>70;
    const rsiLow  = L.rsi<30;

    if (mode === "fast"){
      if (emaBull && macdBull && !rsiHigh) { bias="buy"; reason.push("تقاطع EMA صعودي وMACD إيجابي"); }
      else if (emaBear && macdBear && !rsiLow){ bias="sell"; reason.push("تقاطع EMA هبوطي وMACD سلبي"); }
    }else if (mode === "safe"){
      if (emaBull && macdBull && L.rsi>45 && L.rsi<65){ bias="buy"; reason.push("ترند صاعد واضح وRSI معتدل"); }
      else if (emaBear && macdBear && L.rsi>35 && L.rsi<55){ bias="sell"; reason.push("ترند هابط واضح وRSI معتدل"); }
    }else{ // smart
      if (mk==="trend"){
        if (emaBull && macdBull && !rsiHigh){ bias="buy"; reason.push("ترند صاعد وتأكيد من MACD وRSI"); }
        else if (emaBear && macdBear && !rsiLow){ bias="sell"; reason.push("ترند هابط وتأكيد من MACD وRSI"); }
      }else if (mk==="range"){
        if (rsiLow) { bias="buy"; reason.push("RSI في منطقة بيع مبالغ"); }
        else if (rsiHigh){ bias="sell"; reason.push("RSI في منطقة شراء مبالغ"); }
      }else{
        bias="wait";
        reason.push("سوق حيادي – الإنتظار أفضل");
      }
    }

    // لو في نمط شموع قوي ممكن نضيفه لاحقاً داخل القرار

    if (bias==="buy")   return { text:`✅ تلميح: أفضلية للشراء (${reason.join(" + ")})`, mood:"good" };
    if (bias==="sell")  return { text:`⚠ تلميح: أفضلية للبيع (${reason.join(" + ")})`,  mood:"bad"  };
    return { text:`⏸ تلميح: الإنتظار – لا يوجد توافق قوي بين المؤشرات (مود: ${mode}, سوق: ${mk})`, mood:"neutral" };
  }

  function updateAdviceLast(){
    const adv = makeAdvice(lastIndicators, state.mode, state.market);
    adviceEl.textContent = adv.text;
    adviceEl.className = adv.mood;
  }

  // ===== events =====
  btnSave.addEventListener("click", ()=>{
    saveState();
    log("saved worker:", state.worker);
    setStatus("تم حفظ العنوان.");
  });

  btnPrice.addEventListener("click", fetchPrice);
  btnBars .addEventListener("click", fetchBars);

  workerInput.addEventListener("keydown", e=>{
    if (e.key === "Enter") fetchPrice();
  });

  // محاولة تشغيل تلقائي خفيفة
  if (state.worker && okURL(state.worker)){
    setTimeout(()=>{ fetchBars().catch(()=>{}); }, 500);
  }

})();
