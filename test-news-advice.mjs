import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./web/src/ui/app_mobile.js', import.meta.url), 'utf8');
const store = new Map();
const controls = new Map([
  ['#nyFilterOn',{checked:true}],
  ['#nyStart',{value:'08:00'}],
  ['#nyEnd',{value:'17:00'}],
  ['#pivotFilterOn',{checked:true}],
  ['#pivotDistance',{value:'0.70'}]
]);
const windowMock = { addEventListener: () => {}, dispatchEvent: () => {}, GSXNewsState: null };
const context = vm.createContext({
  console, Date, Math, Number, Array, Object, String, JSON, Promise,
  window: windowMock,
  document: { querySelector: selector => controls.get(selector)||null, querySelectorAll: () => [], addEventListener: () => {}, hidden: false },
  localStorage: {
    getItem: key => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key)
  },
  location: { href: '' }, URLSearchParams,
  setInterval: () => 0,
  setTimeout: () => 0,
  fetch: async () => { throw new Error('fetch not expected'); }
});
vm.runInContext(source, context);

let requestedSignalsUrl='';
context.fetch=async url=>{
  requestedSignalsUrl=String(url);
  return {ok:true,json:async()=>({ok:true,signals:[]})};
};
await vm.runInContext("fetchCentralDecision('https://worker.example','5m')",context);
let requestedParams=new URL(requestedSignalsUrl).searchParams;
assert.equal(requestedParams.get('nyFilterOn'),'1');
assert.equal(requestedParams.get('nyStart'),'08:00');
assert.equal(requestedParams.get('nyEnd'),'17:00');
assert.equal(requestedParams.get('pivotFilterOn'),'1');
assert.equal(requestedParams.get('pivotDistance'),'0.7');

controls.get('#nyFilterOn').checked=false;
controls.get('#pivotFilterOn').checked=false;
controls.get('#pivotDistance').value='1.25';
await vm.runInContext("fetchCentralDecision('https://worker.example','1m')",context);
requestedParams=new URL(requestedSignalsUrl).searchParams;
assert.equal(requestedParams.get('nyFilterOn'),'0');
assert.equal(requestedParams.get('pivotFilterOn'),'0');
assert.equal(requestedParams.get('pivotDistance'),'1.25');

function makeTrend(direction, count = 120, stepMs = 60000) {
  const rows = [];
  const end = Math.floor((Date.now() - stepMs * 2) / stepMs) * stepMs;
  let price = direction === 'up' ? 2400 : 2600;
  for (let i = 0; i < count; i++) {
    const o = price;
    const c = direction === 'up' ? o + 0.8 : o - 0.8;
    rows.push({ t: end - (count - 1 - i) * stepMs, o, h: Math.max(o, c) + 0.1, l: Math.min(o, c) - 0.1, c, v: 10 });
    price = c + (direction === 'up' ? 0.12 : -0.12);
  }
  return rows;
}

function advice(bars, news = null) {
  context.input = {
    bars,
    context: {
      tf: '1m',
      mtf: [
        { tf: '5m', bars: makeTrend('up', 100, 300000), source: 'd1' },
        { tf: '15m', bars: makeTrend('up', 100, 900000), source: 'd1' }
      ],
      expectedMtf: 2,
      live: { price: bars.at(-1).c, ts: Date.now(), receivedAt: Date.now(), source: 'd1' },
      barsSource: 'd1',
      dataQuality: { ok: true, gaps: 0, duplicates: 0, reason: 'جودة الشموع سليمة' },
      enforceMTF: true,
      enforceFresh: true,
      news
    }
  };
  return vm.runInContext('computeAdvice(input.bars,input.context)', context);
}

const up = makeTrend('up');
const technical = advice(up);
assert.equal(technical.side, 'buy');

const supportive = advice(up, {
  ok: true,
  stale: false,
  goldBias: { direction: 'bullish', confidence: 90 },
  safety: { blockTechnicalSignal: false }
});
assert.equal(supportive.side, 'buy');
assert.ok(supportive.bullScore > technical.bullScore);
assert.ok(supportive.bullScore - technical.bullScore <= 0.900001, 'news weight must stay bounded');
assert.ok(supportive.reasons.some(reason => reason.includes('الأخبار داعمة')));

const blocked = advice(up, {
  ok: true,
  stale: false,
  goldBias: { direction: 'bullish', confidence: 90 },
  safety: { blockTechnicalSignal: true, reason: 'خبر شديد التأثير؛ اختبار' }
});
assert.equal(blocked.side, 'none', 'fresh critical news must veto a trade');
assert.ok(blocked.reasons.some(reason => reason.includes('خبر شديد التأثير')));

const opposing = advice(up, {
  ok: true,
  stale: false,
  goldBias: { direction: 'bearish', confidence: 90 },
  safety: { blockTechnicalSignal: false }
});
assert.notEqual(opposing.side, 'sell', 'news alone must never reverse a strong technical setup into a trade');

context.input = {
  bars: up,
  context: {
    tf: '1m',
    live: { price: up.at(-1).c, ts: Date.now(), receivedAt: Date.now(), source: 'd1' },
    barsSource: 'd1',
    dataQuality: { ok: false, gaps: 1, duplicates: 0, reason: 'جودة الشموع غير سليمة: فجوة اختبار' },
    enforceFresh: true
  }
};
const badQuality = vm.runInContext('computeAdvice(input.bars,input.context)', context);
assert.equal(badQuality.side, 'none', 'bad candle quality must veto a live trade');
assert.ok(badQuality.reasons.some(reason => reason.includes('فجوة اختبار')));

context.rsiCloses=Array.from({length:80},(_,index)=>2400+Math.sin(index/4)*8+index*0.1);
const rsiValues=vm.runInContext('calcRSI(rsiCloses,14)',context);
assert.equal(rsiValues.length,context.rsiCloses.length,'RSI values must stay aligned with candle timestamps');
assert.equal(rsiValues.slice(0,14).every(value=>value===null),true);
assert.equal(Number.isFinite(rsiValues[14]),true,'the first RSI value belongs to candle index 14');
assert.equal(rsiValues.filter(Number.isFinite).every(value=>value>=0&&value<=100),true);

context.previewTrade={
  side:'buy',text:'local buy',conf:80,entry:100,tp1:101,tp2:102,sl:99,
  reasons:['local'],tf:'1m',signalBarTs:Date.now()
};
vm.runInContext('activeSignal=null; applyAdvice(previewTrade,{authoritative:true})',context);
assert.equal(vm.runInContext('activeSignal',context),null,'an authoritative render must never turn a local preview into an official trade');
context.serverNone={side:'none',text:'مراقبة فقط',conf:0,reasons:['server none']};
const centralNone=vm.runInContext('centralEvaluationAdvice(serverNone,previewTrade)',context);
assert.equal(centralNone.side,'none','the server none decision must override an actionable local preview');
assert.equal(centralNone.entry,null);

context.qualityRows = [
  { t: Date.UTC(2026,7,27,12,0), o:2400,h:2401,l:2399,c:2400.5,v:1 },
  { t: Date.UTC(2026,7,27,12,1), o:2400.5,h:2401,l:2400,c:2400.7,v:1 },
  { t: Date.UTC(2026,7,27,12,1), o:2400.5,h:2401,l:2400,c:2400.7,v:1 },
  { t: Date.UTC(2026,7,27,12,4), o:2400.7,h:2401,l:2400,c:2400.8,v:1 }
];
const inspected = vm.runInContext("normalizeBarsFrame(qualityRows,'1m')", context);
assert.equal(inspected.bars.length, 3, 'duplicate timestamps must be removed');
assert.equal(inspected.quality.duplicates, 1);
assert.equal(inspected.quality.gaps, 1);
assert.equal(inspected.quality.ok, false);

context.weekendRows = [
  { t: Date.UTC(2026,7,28,20,59), o:2400,h:2401,l:2399,c:2400.5,v:1 },
  { t: Date.UTC(2026,7,30,22,0), o:2401,h:2402,l:2400,c:2401.5,v:1 }
];
const weekend = vm.runInContext("normalizeBarsFrame(weekendRows,'1m')", context);
assert.equal(weekend.quality.gaps, 0, 'normal weekend market closure must not be flagged');

context.trades = [
  { netR: 1.25, ambiguous: false, conf: 82 },
  { netR: -1, ambiguous: false, conf: 74 },
  { netR: 0.75, ambiguous: false, conf: 78 },
  { netR: -1, ambiguous: true, conf: 71 }
];
const stats = vm.runInContext('summarizeBacktestTrades(trades)', context);
assert.ok(stats.winLow < stats.winPct && stats.winPct < stats.winHigh, 'win rate must include a 95% uncertainty range');
assert.equal(stats.avgSignalScore, 76.25, 'the displayed model score must stay separate from observed win rate');
assert.equal(vm.runInContext("backtestSampleLabel({trades:4,oos:{trades:1,netR:-1}})", context), 'عينة غير كافية');

console.log('news advice tests passed');
