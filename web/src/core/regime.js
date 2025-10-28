import { computeADX, computeBB, sma } from './indicators.js';
export function classifyRegime(bars, closes) {
  const adx = computeADX(bars, 14) ?? 0;
  const bb = computeBB(closes, 20, 2);
  const width = bb ? bb.width : 0;
  const m1 = closes.length>50 ? sma(closes.slice(0, closes.length-1), 50) : 0;
  const m2 = closes.length>50 ? sma(closes, 50) : 0;
  const slope = m1 && m2 ? (m2-m1)/(m1||1) : 0;
  let scoreTrend = 0;
  if (adx > 25) scoreTrend += 0.6; else if (adx > 20) scoreTrend += 0.4;
  if (width > 0.012) scoreTrend += 0.25;
  if (Math.abs(slope) > 0.0008) scoreTrend += 0.15;
  let regime = 'NEUTRAL';
  if (scoreTrend >= 0.5) regime = 'TREND';
  else if (width < 0.006 && adx < 20) regime = 'RANGE';
  return { regime, adx, slope, bbWidth: width, bb };
}
