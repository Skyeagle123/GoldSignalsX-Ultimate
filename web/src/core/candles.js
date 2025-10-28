export function detectCandles(bars) {
  const out=[]; const n=bars.length; if(n<3) return out;
  const last=bars[n-1], prev=bars[n-2];
  const body=b=>Math.abs(b.c-b.o), range=b=>b.h-b.l, bull=b=>b.c>b.o, bear=b=>b.c<b.o;
  if (body(last) > 0.6*range(last) && body(prev) > 0) {
    const bEng = bull(last)&&bear(prev)&& last.c>=Math.max(prev.o,prev.c) && last.o<=Math.min(prev.o,prev.c);
    const sEng = bear(last)&&bull(prev)&& last.c<=Math.min(prev.o,prev.c) && last.o>=Math.max(prev.o,prev.c);
    if (bEng) out.push({type:'BullishEngulfing', dir:+1, score:0.7});
    if (sEng) out.push({type:'BearishEngulfing', dir:-1, score:0.7});
  }
  const upper=last.h-Math.max(last.o,last.c), lower=Math.min(last.o,last.c)-last.l;
  const pb= body(last)>0 ? Math.max(upper,lower)/body(last) : 0;
  if (pb>=2){ if (lower>upper) out.push({type:'Hammer', dir:+1, score:0.6}); else out.push({type:'ShootingStar', dir:-1, score:0.6}); }
  if (body(last) <= 0.1*range(last)) out.push({type:'Doji', dir:0, score:0.4});

  // Extended candle patterns
  const a = bars[n-3], b = bars[n-2], c = bars[n-1];
  if (a && b && c) {
    const small=x=>Math.abs(x.c-x.o)<=0.3*(x.h-x.l);
    if (a.c<a.o && small(b) && c.c>c.o && c.c >= (a.o+a.c)/2) out.push({type:'MorningStar', dir:+1, score:0.8});
    if (a.c>a.o && small(b) && c.c<c.o && c.c <= (a.o+a.c)/2) out.push({type:'EveningStar', dir:-1, score:0.8});
    if (Math.abs(b.c-b.o)<Math.abs(a.c-a.o)*0.5 &&
        Math.max(b.o,b.c)<=Math.max(a.o,a.c) &&
        Math.min(b.o,b.c)>=Math.min(a.o,a.c))
      out.push({type:(a.c>a.o?'BearishHarami':'BullishHarami'),dir:(a.c>a.o?-1:+1),score:0.6});
    if (Math.abs(b.c-b.o)<=0.1*(b.h-b.l) &&
        Math.max(b.o,b.c)<=Math.max(a.o,a.c) &&
        Math.min(b.o,b.c)>=Math.min(a.o,a.c))
      out.push({type:'HaramiCross',dir:(a.c>a.o?-1:+1),score:0.6});
    if (a.c<a.o && c.c>c.o && c.o<a.c && c.c>(a.o+a.c)/2) out.push({type:'PiercingLine',dir:+1,score:0.7});
    if (a.c>a.o && c.c<c.o && c.o>a.c && c.c<(a.o+a.c)/2) out.push({type:'DarkCloudCover',dir:-1,score:0.7});
    if (n>=3){
      const x1=bars[n-3],x2=bars[n-2],x3=bars[n-1];
      if (x1.c>x1.o && x2.c>x2.o && x3.c>x3.o && x3.c>x2.c && x2.c>x1.c) out.push({type:'ThreeWhiteSoldiers',dir:+1,score:0.9});
      if (x1.c<x1.o && x2.c<x2.o && x3.c<x3.o && x3.c<x2.c && x2.c<x1.c) out.push({type:'ThreeBlackCrows',dir:-1,score:0.9});
    }
  }
  return out;
}
