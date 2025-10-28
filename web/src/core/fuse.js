import { computeRSI, computeMACD, computeStochastic, ema } from './indicators.js';
export function tradeModeDefaults(mode){
  switch(mode){
    case 'fast': return { atrMult:1.0, bbStd:1.5, emaFast:9, emaSlow:21, rsiP:14, macdF:12, macdS:26, macdSig:9, stochK:14, stochD:3 };
    case 'safe': return { atrMult:1.6, bbStd:2.5, emaFast:12, emaSlow:50, rsiP:14, macdF:12, macdS:26, macdSig:9, stochK:14, stochD:3 };
    default:     return { atrMult:1.3, bbStd:2.0, emaFast:10, emaSlow:34, rsiP:14, macdF:12, macdS:26, macdSig:9, stochK:14, stochD:3 };
  }
}
export function fuseSignals({ candlesSig, regime, closes, bars, cfg }){
  const eFast = ema(closes, cfg.emaFast), eSlow = ema(closes, cfg.emaSlow);
  const rsi = cfg.rsiOn ? computeRSI(closes, cfg.rsiP) : null;
  const macd = cfg.macdOn ? computeMACD(closes, cfg.macdF, cfg.macdS, cfg.macdSig) : null;
  const stoch = cfg.stochOn ? computeStochastic(bars, cfg.stochK, cfg.stochD) : null;

  let tech = 0, reasons=[];
  if (cfg.emaOn && eFast!=null && eSlow!=null){
    const bias = eFast>eSlow ? +1 : eFast<eSlow ? -1 : 0;
    tech += 0.4*bias; if (bias!==0) reasons.push('تقاطع EMA');
  }
  if (macd){ const mSign = Math.sign(macd.macd); tech += 0.3*mSign; reasons.push('إشارة MACD'); }
  if (rsi!=null){ if (rsi>60) tech += 0.15; else if (rsi<40) tech -= 0.15; reasons.push('RSI منطقة'); }
  if (stoch){ if (stoch.k>70) tech += 0.1; else if (stoch.k<30) tech -= 0.1; reasons.push('Stochastic'); }

  const dirFromCandles = candlesSig.some(s=>s.dir===+1) ? +1 : candlesSig.some(s=>s.dir===-1) ? -1 : 0;
  let wC=0.35, wT=0.65; if (regime==='RANGE'){ wC=0.45; wT=0.55; } if (regime==='TREND'){ wC=0.30; wT=0.70; }

  let score=0; score += wC * (dirFromCandles!==0 ? 0.7 : 0); score += wT * Math.min(0.9, Math.abs(tech)); if (dirFromCandles && Math.sign(tech)===dirFromCandles) score += 0.1;
  let dir=0; if (score>=0.6) dir = tech>0? +1 : tech<0? -1 : dirFromCandles;
  const advice = dir>0? 'شراء' : dir<0? 'بيع' : 'حيادي';
  return { advice, confidence:+score.toFixed(2), reasons, eFast, eSlow, rsi, macd, stoch };
}
