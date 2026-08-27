// news.js — GoldSignalsX news intelligence v1
(function () {
  'use strict';

  const DEFAULT_BASE = 'https://GoldSignalsX-worker.samer-mourtada.workers.dev';
  const REFRESH_MS = 5 * 60 * 1000;
  const TOAST_KEY = 'GSX_NEWS_TOAST_V1';
  const $ = selector => document.querySelector(selector);

  const refs = {};
  let refreshRunning = false;

  function getBase() {
    const input = ($('#base')?.value || '').trim();
    const saved = localStorage.getItem('GSX_BASE_URL') || '';
    return (input || saved || DEFAULT_BASE).replace(/\/+$/, '');
  }

  function directionMeta(direction) {
    if (direction === 'bullish') return { text: 'داعم للذهب', className: 'news-up', icon: '↗' };
    if (direction === 'bearish') return { text: 'ضاغط على الذهب', className: 'news-down', icon: '↘' };
    return { text: 'محايد', className: 'news-neutral', icon: '→' };
  }

  function importanceMeta(importance) {
    if (Number(importance) >= 3) return { text: 'عاجل', className: 'high' };
    if (Number(importance) === 2) return { text: 'مهم', className: 'medium' };
    return { text: 'متابعة', className: '' };
  }

  function relativeAge(timestamp) {
    const age = Date.now() - Number(timestamp || 0);
    if (!Number.isFinite(age) || age < 0) return 'الآن';
    const minutes = Math.floor(age / 60000);
    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `منذ ${minutes} د`;
    const hours = Math.floor(minutes / 60);
    return `منذ ${hours} س`;
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ''));
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }

  function textElement(tag, text, className = '') {
    const el = document.createElement(tag);
    el.textContent = text;
    if (className) el.className = className;
    return el;
  }

  function renderItem(item) {
    const url = safeUrl(item?.url);
    const container = document.createElement(url ? 'a' : 'div');
    const importance = importanceMeta(item?.importance);
    const direction = directionMeta(item?.direction);
    container.className = `news-item ${importance.className}`.trim();
    if (url) {
      container.href = url;
      container.target = '_blank';
      container.rel = 'noopener noreferrer';
    }

    container.appendChild(textElement('div', String(item?.title || 'خبر بلا عنوان')));
    if (item?.reason) container.appendChild(textElement('div', String(item.reason), 'small'));
    const meta = document.createElement('div');
    meta.className = 'news-meta';
    meta.appendChild(textElement('span', importance.text));
    meta.appendChild(textElement('span', `${direction.icon} ${direction.text}`, direction.className));
    meta.appendChild(textElement('span', `ثقة ${Math.round(Number(item?.confidence || 0))}%`));
    if (item?.domain) meta.appendChild(textElement('span', String(item.domain)));
    meta.appendChild(textElement('span', relativeAge(item?.seenAt)));
    container.appendChild(meta);
    return container;
  }

  function showCriticalToast(brief) {
    const critical = (brief?.items || []).find(item => Number(item?.importance) >= 3 && item?.direction !== 'neutral');
    if (!critical) return;
    const id = String(critical.id || `${critical.title}|${critical.seenAt}`);
    if (localStorage.getItem(TOAST_KEY) === id) return;
    localStorage.setItem(TOAST_KEY, id);
    const toast = $('#toast');
    const title = $('#toastTitle');
    const message = $('#toastMsg');
    if (!toast || !title || !message) return;
    const direction = directionMeta(critical.direction);
    title.textContent = 'خبر مهم للذهب';
    message.textContent = `${direction.text}: ${critical.title}`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 12000);
  }

  function renderBrief(brief) {
    const bias = directionMeta(brief?.goldBias?.direction);
    if (refs.top) {
      refs.top.textContent = bias.text;
      refs.top.className = bias.className;
    }
    if (refs.bias) {
      refs.bias.textContent = bias.text;
      refs.bias.className = bias.className;
    }
    if (refs.confidence) refs.confidence.textContent = `${Math.round(Number(brief?.goldBias?.confidence || 0))}%`;
    if (refs.safety) {
      const blocked = !!brief?.safety?.blockTechnicalSignal;
      refs.safety.textContent = blocked ? 'توقّف مؤقت' : 'متاح فنياً';
      refs.safety.className = blocked ? 'news-down' : 'news-up';
    }
    if (refs.updated) refs.updated.textContent = relativeAge(brief?.updatedAt);
    if (refs.advice) {
      const advice = String(brief?.goldBias?.advice || 'لا يوجد ميل إخباري واضح حالياً.');
      const safety = brief?.safety?.blockTechnicalSignal ? ` ${brief.safety.reason || ''}` : '';
      refs.advice.textContent = `${advice}${safety}`.trim();
    }

    if (refs.list) {
      refs.list.replaceChildren();
      for (const item of brief?.items || []) refs.list.appendChild(renderItem(item));
    }
    if (refs.empty) refs.empty.style.display = (brief?.items || []).length ? 'none' : 'block';

    window.GSXNewsState = brief;
    window.dispatchEvent(new CustomEvent('gsx:news-updated', { detail: brief }));
    showCriticalToast(brief);
  }

  function renderUnavailable(message) {
    if (refs.top) {
      refs.top.textContent = 'غير متاحة';
      refs.top.className = 'news-neutral';
    }
    if (refs.bias) refs.bias.textContent = 'غير متاح';
    if (refs.confidence) refs.confidence.textContent = '—';
    if (refs.safety) refs.safety.textContent = 'لا يؤثر على النصيحة';
    if (refs.updated) refs.updated.textContent = '—';
    if (refs.advice) refs.advice.textContent = message || 'تعذّر تحديث الأخبار. النصيحة الفنية لا تستخدم بيانات أخبار قديمة.';
    window.GSXNewsState = null;
    window.dispatchEvent(new CustomEvent('gsx:news-updated', { detail: null }));
  }

  async function refreshNews() {
    if (refreshRunning) return;
    refreshRunning = true;
    if (refs.button) {
      refs.button.disabled = true;
      refs.button.textContent = 'جاري التحديث…';
    }
    try {
      const response = await fetch(`${getBase()}/news`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const brief = await response.json();
      if (!brief?.ok) throw new Error('invalid news response');
      renderBrief(brief);
    } catch (error) {
      renderUnavailable('الأخبار غير متاحة حالياً؛ لن تدخل في حساب النصيحة حتى يعود المصدر.');
      console.warn('[GSX news]', error);
    } finally {
      refreshRunning = false;
      if (refs.button) {
        refs.button.disabled = false;
        refs.button.textContent = 'تحديث الأخبار';
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    refs.top = $('#newsTop');
    refs.bias = $('#newsBias');
    refs.confidence = $('#newsConfidence');
    refs.safety = $('#newsSafety');
    refs.updated = $('#newsUpdated');
    refs.advice = $('#newsAdvice');
    refs.list = $('#newsList');
    refs.empty = $('#newsEmpty');
    refs.button = $('#btnNewsRefresh');
    refs.button?.addEventListener('click', refreshNews);
    $('#saveBase')?.addEventListener('click', () => setTimeout(refreshNews, 100));
    $('#toastClose')?.addEventListener('click', () => $('#toast')?.classList.remove('show'));
    refreshNews();
    setInterval(() => {
      if (!document.hidden) refreshNews();
    }, REFRESH_MS);
  });

  window.GSXRefreshNews = refreshNews;
})();
