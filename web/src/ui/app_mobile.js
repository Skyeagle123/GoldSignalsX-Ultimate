/* === GSX: minimal drop-in fetch & render hook (non-breaking) === */
/* 1) هوك عام: إذا عندك pannels.setSeries بنستعمله، وإلا منرمي اللوغ */
window.gsxLoadBars = window.gsxLoadBars || function(bars, tf){
  try {
    if (window.pannels && typeof window.pannels.setSeries === 'function') {
      window.pannels.setSeries(bars, tf);
    } else if (window.chart && typeof window.chart.setData === 'function') {
      // دعم مكتبة lightweight-charts إن وُجدت
      window.chart.setData(bars.map(b => ({
        time: Math.floor(b.t/1000), open:b.o, high:b.h, low:b.l, close:b.c
      })));
    } else {
      console.log('[GSX] bars received (preview):', tf, bars.slice(0,3));
    }
  } catch(e){ console.warn('[GSX] render failed:', e); }
};

/* 2) أدوات مساعدة لاختيار عناصر الواجهة الحالية من دون تغيير HTML */
(function GSX_Bootstrap(){
  const qAll = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // محاولة ذكية لإيجاد خانة الـ Worker URL
  function getWorkerURL(){
    // أي input/textarea فيه workers.dev أو يبدأ بـ https
    const cand = qAll('input,textarea').find(el =>
      /workers\.dev/.test(el.value || '') || /^https?:\/\//.test(el.value || '')
    );
    return (cand && cand.value.trim()) || '';
  }

  // قراءة TF المختار من أزرار التايم-فريم؛ افتراضي 1m
  function getSelectedTF(){
    // جرّب زر مفعّل
    const active = qAll('button, .btn, .chip, .tab').find(b =>
      (b.className||'').includes('active')
      && /^(?:1|5|15|30|60|240|يوم|د|m)$/i.test(b.textContent.trim())
    );
    const txt = (active ? active.textContent.trim() : '1').toLowerCase();

    // خرائط شائعة
    if (txt.includes('يوم') || txt === 'd' || txt === '1d') return '1d';
    if (txt === '240') return '240m';
    if (txt === '60') return '60m';
    if (txt === '30') return '30m';
    if (txt === '15') return '15m';
    if (txt === '5')  return '5m';
    return '1m';
  }

  // تحديد limit من حقل “Limit” إن وجد، وإلا 1200
  function getLimit(){
    const cand = qAll('input').find(el =>
      /limit/i.test(el.previousElementSibling?.textContent||'') ||
      /limit/i.test(el.getAttribute('aria-label')||'') ||
      /\blimit\b/i.test(el.name||'')
    );
    const v = parseInt(cand?.value || '1200', 10);
    return isFinite(v) && v>0 ? v : 1200;
  }

  // إيجاد زر “جلب الشموع”
  function findFetchButton(){
    const btns = qAll('button, .btn');
    return btns.find(b => /جلب|شموع|fetch|candles/i.test(b.textContent || ''));
  }

  // محوّل فورمات worker → فورمات الرسم
  function normalizeBars(raw){
    // نتوقع [{t,o,h,l,c,v}] أو [{time,open,...}]
    return raw.map(r => {
      if ('t' in r) return { t:r.t, o:+r.o, h:+r.h, l:+r.l, c:+r.c, v:+(r.v||0) };
      // دعم بديل
      return {
        t: ('time' in r ? (''+r.time).length<=10 ? r.time*1000 : r.time : Date.now()),
        o:+r.open, h:+r.high, l:+r.low, c:+r.close, v:+(r.volume||0)
      };
    });
  }

  async function fetchAndRender(){
    const base = getWorkerURL();
    const tf   = getSelectedTF();
    const lim  = getLimit();

    if (!base) { console.warn('[GSX] Worker URL not set'); return; }

    // طريقتان مقبولتان: /bars أو /bars/tf=15m&limit=1200
    const url = base.replace(/\/+$/,'') + `/bars?tf=${encodeURIComponent(tf)}&limit=${lim}`;

    try {
      const res = await fetch(url, { headers: { 'accept':'application/json' }});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // قد يكون {ok:true, bars:[...]}
      const bars = Array.isArray(data) ? data : (data.bars || []);
      if (!bars.length) { console.warn('[GSX] empty bars from worker'); return; }
      const norm = normalizeBars(bars);
      window.gsxLoadBars(norm, tf);
      console.log(`[GSX] drew ${norm.length} bars for ${tf}`);
    } catch (e){
      console.error('[GSX] fetch error:', e);
    }
  }

  // ربط الزر تلقائياً بدون لمس HTML الأصلي
  function wire(){
    const btn = findFetchButton();
    if (!btn) { setTimeout(wire, 800); return; } // نعيد المحاولة حتى تظهر الواجهة
    if (btn.dataset.gsxWired) return;
    btn.dataset.gsxWired = '1';
    btn.addEventListener('click', fetchAndRender, { passive:true });
    // خيار: جلب تلقائي عند فتح الصفحة بعد 600ms
    setTimeout(() => { try { fetchAndRender(); } catch(_e){} }, 600);
    console.log('[GSX] fetch button wired');
  }

  wire();
})();
