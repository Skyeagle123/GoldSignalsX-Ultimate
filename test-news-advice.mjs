import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./web/src/ui/app_mobile.js', import.meta.url), 'utf8');
const store = new Map();
const performanceTableBody={innerHTML:'',children:[],appendChild(node){this.children.push(node);}};
const forwardValidationTableBody={innerHTML:'',children:[],appendChild(node){this.children.push(node);}};
const controls = new Map([
  ['#nyFilterOn',{checked:true}],
  ['#nyStart',{value:'08:00'}],
  ['#nyEnd',{value:'17:00'}],
  ['#pivotFilterOn',{checked:true}],
  ['#pivotDistance',{value:'0.70'}],
  ['#signalTimeframe',{textContent:''}],
  ['#adviceText',{textContent:''}],
  ['#adviceKind',{textContent:'',style:{}}],
  ['#activeSignalDetails',{style:{}}],
  ['#bullScoreVal',{textContent:''}],
  ['#bearScoreVal',{textContent:''}],
  ['#signalNewsRisk',{textContent:'',style:{}}],
  ['#signalNewsRiskDetails',{textContent:'',className:''}],
  ['#mtfVal',{textContent:''}],
  ['#mtfLaterVal',{textContent:''}],
  ['#perfSignals',{textContent:''}],
  ['#perfWins',{textContent:''}],
  ['#perfLosses',{textContent:''}],
  ['#perfExpired',{textContent:''}],
  ['#perfWinRate',{textContent:''}],
  ['#perfMfe',{textContent:''}],
  ['#perfMae',{textContent:''}],
  ['#performanceStatus',{textContent:''}],
  ['#forwardValidationStatus',{textContent:''}],
  ['#forwardValidationTable tbody',forwardValidationTableBody],
  ['#performanceTable tbody',performanceTableBody]
]);
const windowMock = { addEventListener: () => {}, dispatchEvent: () => {}, GSXNewsState: null };
const context = vm.createContext({
  console, Date, Math, Number, Array, Object, String, JSON, Promise,
  window: windowMock,
  document: {
    querySelector: selector => controls.get(selector)||null,
    querySelectorAll: () => [],addEventListener: () => {},hidden: false,
    createElement: tag=>({tagName:tag,textContent:'',className:'',children:[],appendChild(node){this.children.push(node);}})
  },
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

for (const status of ['active','tp1']) {
  const staleStoredSignal={
    id:`5m:${Date.now()-2*60*60_000}:buy`,tf:'5m',status,side:'buy',origin:'server',
    entry:100,tp1:101,tp2:102,sl:99,createdAt:Date.now()-2*60*60_000,lastPrice:100
  };
  store.set('GSX_ACTIVE_SIGNAL_V1',JSON.stringify(staleStoredSignal));
  vm.runInContext('activeSignal=null; restoreActiveSignal()',context);
  assert.equal(vm.runInContext('activeSignal',context),null,
    `an old locally cached ${status} server signal must not remain Current Advice during market closure`);
  assert.equal(store.has('GSX_ACTIVE_SIGNAL_V1'),false,
    'the PWA must discard an old cache without inventing an authoritative Expired transition');
}

let requestedSignalsUrl='';
context.fetch=async url=>{
  requestedSignalsUrl=String(url);
  return {ok:true,json:async()=>({ok:true,signals:[]})};
};
await vm.runInContext("fetchCentralDecision('https://worker.example','5m')",context);
let requestedParams=new URL(requestedSignalsUrl).searchParams;
assert.equal(requestedParams.has('tf'),false,'the PWA must fetch all signal states so the active Primary remains visible across chart timeframes');
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

const timeframeLabels={
  '1m':'1m — دقيقة','5m':'5m — 5 دقائق','15m':'15m — 15 دقيقة',
  '30m':'30m — 30 دقيقة','60m':'60m — ساعة','240m':'240m — 4 ساعات'
};
for (const [tf,label] of Object.entries(timeframeLabels)) {
  for (const status of ['active','tp1','tp2','stopped','expired']) {
    context.timeframeSignal={
      tf,status,side:'sell',entry:100,tp1:99,tp2:98,sl:101,
      createdAt:Date.now(),lastPrice:100
    };
    vm.runInContext('renderSignalMeta(timeframeSignal)',context);
    assert.equal(
      controls.get('#signalTimeframe').textContent,label,
      `${tf} must remain visible when the official signal status is ${status}`
    );
  }
}

const mtfCreatedAt=Date.now();
context.mtfDisplaySignal={
  id:`5m:${mtfCreatedAt}:sell`,tf:'5m',status:'active',side:'sell',origin:'server',
  entry:100,tp1:99,tp2:98,sl:101,conf:88,createdAt:mtfCreatedAt,lastPrice:100,
  mtf:{bull:0,bear:2,neutral:0},
  mtfAtEntry:{
    capturedAt:Date.now(),primaryTf:'5m',relatedTimeframes:['15m','60m'],
    summary:{bull:0,bear:2,neutral:0}
  },
  mtfConfirmations:[
    {type:'later-confirmation',confirmationSignalId:'1m:later:sell',primarySignalId:`5m:${mtfCreatedAt}:sell`,tf:'1m',side:'sell',confirmedAt:Date.now()}
  ]
};
context.mtfEntryEvaluation={bull:2.4,bear:9.1,score:9.1,evaluatedAt:mtfCreatedAt};
context.fetch=async()=>({
  ok:true,
  json:async()=>({ok:true,signals:[{tf:'5m',state:context.mtfDisplaySignal,evaluation:context.mtfEntryEvaluation}]})
});
const centralMtf=await vm.runInContext("fetchCentralDecision('https://worker.example','5m')",context);
assert.equal(centralMtf.state.id,`5m:${mtfCreatedAt}:sell`);
assert.equal(centralMtf.state.mtfConfirmations[0].primarySignalId,centralMtf.state.id);
context.mtfDisplaySignal=centralMtf.state;
for (const status of ['active','tp1']) {
  context.mtfDisplaySignal.status=status;
  vm.runInContext('activeSignal=mtfDisplaySignal; renderAdvice(signalAsAdvice(mtfDisplaySignal,mtfEntryEvaluation))',context);
  assert.equal(controls.get('#mtfVal').textContent,'↑0 / ↓2 / —0 • 15m, 60m');
  assert.equal(
    controls.get('#mtfLaterVal').textContent,'↑0 / ↓1 / —0 • 1m',
    `the linked MTF confirmation must remain separate while the primary status is ${status}`
  );
}
assert.equal(controls.get('#bullScoreVal').textContent,'2.4');
assert.equal(controls.get('#bearScoreVal').textContent,'9.1');
context.newsRiskDisplaySignal={
  ...context.mtfDisplaySignal,newsRiskActive:true,
  newsRisk:{
    status:'active',level:'high',windowStartAt:mtfCreatedAt,windowEndAt:mtfCreatedAt+15*60_000,
    events:[{name:'CPI'}]
  }
};
vm.runInContext('activeSignal=newsRiskDisplaySignal; renderAdvice(signalAsAdvice(newsRiskDisplaySignal,mtfEntryEvaluation))',context);
assert.match(controls.get('#signalNewsRiskDetails').textContent,/News Risk على الـActive Exposure/);
assert.match(controls.get('#signalNewsRiskDetails').textContent,/الإشارة وEntry\/TP\/SL كما هي/,
  'News Risk must remain a warning attached to the active exposure, not a Trading Signal');

context.fetch=async()=>({
  ok:true,
  json:async()=>({
    ok:true,
    exposure:{status:'active',primarySignalId:context.mtfDisplaySignal.id,primaryTf:'5m'},
    signals:[
      {tf:'1m',state:null,evaluation:{side:'none',bull:1,bear:2,evaluatedAt:mtfCreatedAt+1}},
      {tf:'5m',state:context.mtfDisplaySignal,evaluation:context.mtfEntryEvaluation}
    ]
  })
});
const centralAcrossTimeframes=await vm.runInContext("fetchCentralDecision('https://worker.example','1m')",context);
assert.equal(centralAcrossTimeframes.state.id,context.mtfDisplaySignal.id,
  'the active Primary Signal must remain Current Advice when a different chart timeframe is selected');
context.fetch=async()=>({
  ok:true,
  json:async()=>({
    ok:true,exposure:{status:'flat',primarySignalId:'',primaryTf:''},
    signals:[{tf:'5m',state:context.mtfDisplaySignal,evaluation:context.mtfEntryEvaluation}]
  })
});
const flatExposureDecision=await vm.runInContext("fetchCentralDecision('https://worker.example','5m')",context);
assert.equal(flatExposureDecision.state,null,
  'a stale active-looking state must not override the authoritative flat exposure');

context.staleEntryEvaluation={...context.mtfEntryEvaluation,evaluatedAt:mtfCreatedAt+1};
vm.runInContext('renderAdvice(signalAsAdvice(mtfDisplaySignal,staleEntryEvaluation))',context);
assert.equal(controls.get('#bullScoreVal').textContent,'غير متوفر');
assert.equal(controls.get('#bearScoreVal').textContent,'غير متوفر',
  'direction scores must not mix a later evaluation with the at-entry signal');

context.mtfDisplaySignal.status='expired';
context.fetch=async()=>({
  ok:true,
  json:async()=>({ok:true,signals:[{tf:'5m',state:context.mtfDisplaySignal,evaluation:context.mtfEntryEvaluation}]})
});
const centralTerminal=await vm.runInContext("fetchCentralDecision('https://worker.example','5m')",context);
assert.equal(centralTerminal.state,null,'a terminal signal must not remain Current Advice');
assert.equal(centralTerminal.historicalState.id,context.mtfDisplaySignal.id);
for (const status of ['tp2','sl','stopped','expired','closed']) {
  context.terminalStatusSignal={...context.mtfDisplaySignal,status};
  assert.equal(vm.runInContext('isActiveOfficialSignal(terminalStatusSignal)',context),false,
    `${status} must be historical, never a Current Primary Signal`);
}
vm.runInContext('activeSignal=null; renderAdvice(centralEvaluationAdvice(mtfEntryEvaluation,previewTrade))',context);
assert.equal(controls.get('#adviceText').textContent,'لا توجد إشارة رسمية نشطة');
assert.equal(controls.get('#adviceKind').textContent,'No active official signal');
assert.equal(controls.get('#activeSignalDetails').style.display,'none');

assert.equal(vm.runInContext("performanceRecordStatus({finalStatus:'expired'}).label",context),'Expired — ليس Win أو Loss');
assert.equal(vm.runInContext("performanceRecordStatus({finalStatus:'tp2'}).label",context),'TP2 — Win');
assert.equal(vm.runInContext("performanceRecordStatus({finalStatus:'sl'}).label",context),'SL — Loss');
assert.equal(vm.runInContext("performanceRecordStatus({finalStatus:'closed'}).label",context),'Closed — ليس Win أو Loss');
context.performancePayload={
  ok:true,summary:{signals:3,wins:1,losses:1,expired:1},
  dashboard:{
    measurementOnly:true,
    overall:{
      counts:{signals:3,open:0,wins:1,losses:1,expired:1,resolved:2},
      winRate:{numerator:1,denominator:2,valuePct:50,sampleSufficient:false,minimumSample:10},
      atEntry:{
        score:{sampleSize:3,sampleSufficient:true,mean:8.75},
        agreementPct:{sampleSize:1,sampleSufficient:false,mean:60},
        directionalAgreementPct:{sampleSize:1,sampleSufficient:false,mean:75},
        conflictPct:{sampleSize:1,sampleSufficient:false,mean:25}
      },
      postEntry:{
        mfe:{sampleSize:3,sampleSufficient:true,mean:1.5},
        mae:{sampleSize:3,sampleSufficient:true,mean:0.75},
        entryOpportunityPct:{sampleSize:3,sampleSufficient:true,mean:66.666667},
        timeToMfeMs:{sampleSize:3,sampleSufficient:true,mean:120000},
        timeToMaeMs:{sampleSize:3,sampleSufficient:true,mean:180000}
      }
    },
    byTimeframe:[],bySide:[],byScoreBand:[],byFinalStatus:[],
    byConflictLevel:[{
      key:'medium',label:'Conflict medium (25–<50%)',
      counts:{signals:1,open:0,wins:0,losses:1,expired:0,resolved:1},
      winRate:{denominator:1,valuePct:0,sampleSufficient:false},
      atEntry:{score:{sampleSize:1,sampleSufficient:false,mean:8.75},conflictPct:{sampleSize:1,sampleSufficient:false,mean:25}},
      postEntry:{mfe:{sampleSize:1,sampleSufficient:false,mean:1.5},mae:{sampleSize:1,sampleSufficient:false,mean:.75}}
    }],
    byConflictSource:[]
  },
  records:[{
    signalId:'5m:history:expired',createdAt:mtfCreatedAt,timeframe:'5m',direction:'sell',
    finalStatus:'expired',entry:100,tp1:95,tp2:90,sl:105,score:8.75,resultR:0.25,
    quality:{measurementOnly:true,mfe:1.5,mae:0.75},
    newsRisk:{postEntry:{windowCount:1}},
    mtfAnalysis:{
      matrix:{
        measurementOnly:true,agreementPct:60,directionalAgreementPct:75,
        conflictAtEntry:{measurementOnly:true,level:'medium',sourceType:'mtf',combined:{conflictPct:25}}
      },
      laterConfirmations:{summary:{count:2}}
    }
  }]
};
vm.runInContext('renderPerformanceReport(performancePayload)',context);
assert.equal(controls.get('#perfExpired').textContent,'1');
assert.equal(controls.get('#perfWinRate').textContent,'عينة غير كافية (n=2)');
assert.equal(controls.get('#perfMfe').textContent,'1.50 (n=3)');
assert.match(controls.get('#forwardValidationStatus').textContent,/TP2 \+ SL/);
assert.match(forwardValidationTableBody.children[0].children[1].innerHTML,/Signals 3/);
assert.match(forwardValidationTableBody.children[0].children[1].innerHTML,/class="report-win">W 1/);
assert.match(forwardValidationTableBody.children[0].children[1].innerHTML,/class="report-loss">L 1/);
assert.match(forwardValidationTableBody.children[0].children[1].innerHTML,/class="report-expired">E 1/);
assert.equal(forwardValidationTableBody.children[0].children[2].textContent,'عينة غير كافية (n=2)');
assert.match(forwardValidationTableBody.children[0].children[5].textContent,/Entry opportunity 66.7% \(n=3\)/);
assert.match(forwardValidationTableBody.children[0].children[5].textContent,/T→MFE 2.0m \(n=3\)/);
assert.equal(forwardValidationTableBody.children[0].children[7].textContent,'عينة غير كافية (n=1)');
assert.match(forwardValidationTableBody.children[1].children[0].textContent,/Conflict level • Conflict medium/);
assert.equal(vm.runInContext('forwardConflictMetricText({sampleSize:0,mean:null})',context),'Unavailable (n=0)');
assert.match(performanceTableBody.children[0].children[4].textContent,/ليس Win أو Loss/);
assert.equal(performanceTableBody.children[0].children[5].textContent,'8.75');
assert.match(performanceTableBody.children[0].children[6].textContent,/Entry 100.00 • TP1 95.00 • TP2 90.00 • SL 105.00/);
assert.match(performanceTableBody.children[0].children[8].textContent,/Agreement 60.0% • Directional 75.0%/);
assert.match(performanceTableBody.children[0].children[8].textContent,/Conflict 25.0% \(medium • mtf\)/);
assert.doesNotMatch(performanceTableBody.children[0].children[8].textContent,/Confirmations/,
  'MTF-at-Entry must not include later confirmation data');
assert.match(performanceTableBody.children[0].children[9].textContent,/MFE 1.50 • MAE 0.75/);
assert.match(performanceTableBody.children[0].children[10].textContent,/Later confirmations 2 • News Risk windows 1/);

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
