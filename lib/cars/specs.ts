import type { CarSpec } from './types';

// Pulls headline numbers out of the plain text a feed gives us (title, summary, and the full text when the feed includes
// it). Only what is actually stated is shown: nothing is guessed. A max of four chips, most useful first.

const num = (s: string) => Number(s.replace(/,/g, ''));
const nums = (re: RegExp, text: string) => [...text.matchAll(re)].map((m) => m);

export function extractSpecs(text: string): CarSpec[] {
  const t = ` ${text} `;
  const out: CarSpec[] = [];

  // Power: the biggest hp figure mentioned ("up to" when trims differ), else kW.
  const hp = nums(/(\d{2,4}(?:,\d{3})?)\s?-?\s?(?:hp|horsepower|bhp|ps|cv)\b/gi, t).map((m) => num(m[1])).filter((n) => n >= 40 && n <= 4000);
  const kw = nums(/(\d{2,4})\s?kW\b/g, t).map((m) => num(m[1])).filter((n) => n >= 30 && n <= 3000);
  if (hp.length) {
    const max = Math.max(...hp);
    out.push({ kind: 'power', label: `${hp.some((n) => n !== max) ? 'Up to ' : ''}${max.toLocaleString('en-US')} hp` });
  } else if (kw.length) {
    const max = Math.max(...kw);
    out.push({ kind: 'power', label: `${kw.some((n) => n !== max) ? 'Up to ' : ''}${max} kW` });
  }

  // Acceleration.
  const sixty =
    t.match(/0\s?(?:-|–|to)\s?60\s?(?:mph)?[^.]{0,70}?(\d(?:\.\d{1,2})?)\s?(?:seconds|secs?|s)\b/i) ??
    t.match(/(\d(?:\.\d{1,2})?)\s?(?:seconds|secs?)\s?(?:to|for the|from 0 to)\s?(?:reach\s)?(?:0\s?(?:-|to)\s?)?60\s?mph/i);
  const hundred =
    t.match(/0\s?(?:-|–|to)\s?100\s?(?:km\/h|kph)[^.]{0,70}?(\d(?:\.\d{1,2})?)\s?(?:seconds|secs?|s)\b/i) ??
    t.match(/(\d(?:\.\d{1,2})?)\s?(?:seconds|secs?)\s?(?:to|for the)\s?100\s?(?:km\/h|kph)/i);
  if (sixty && Number(sixty[1]) >= 1.5 && Number(sixty[1]) <= 15) out.push({ kind: 'speed', label: `0–60 mph in ${sixty[1]} s` });
  else if (hundred && Number(hundred[1]) >= 1.5 && Number(hundred[1]) <= 15) out.push({ kind: 'speed', label: `0–100 km/h in ${hundred[1]} s` });

  // Electric range and battery.
  const range =
    t.match(/(\d{2,4})\s?(miles|mi|km|kilometers|kilometres)\s?(?:of\s)?(?:estimated\s|EPA[- ]estimated\s|WLTP\s|combined\s)?range/i) ??
    t.match(/range of (?:up to |around |about |roughly |over |more than |nearly )?(\d{2,4})\s?(miles|mi|km)/i) ??
    t.match(/(\d{2,4})\s?(miles|mi|km)\s?(?:on a single charge|per charge|of electric range)/i);
  if (range && num(range[1]) >= 20 && num(range[1]) <= 1500) out.push({ kind: 'range', label: `${num(range[1])} ${/^(mi|miles)$/i.test(range[2]) ? 'mi' : 'km'} range` });
  const battery = nums(/(\d{2,3}(?:\.\d{1,2})?)\s?kWh/g, t).find((m) => /battery|pack/i.test(t.slice(Math.max(0, (m.index ?? 0) - 50), (m.index ?? 0) + 60)));
  if (battery && Number(battery[1]) >= 10 && Number(battery[1]) <= 300) out.push({ kind: 'battery', label: `${battery[1]} kWh battery` });

  // Price: only when a price word is nearby.
  const price = nums(/([$€£]\s?\d{1,3}(?:,\d{3})+|[$€£]\s?\d{2,3}[kK]\b)/g, t).find((m) => /pric|msrp|start|from|cost|base/i.test(t.slice(Math.max(0, (m.index ?? 0) - 60), (m.index ?? 0) + 20)));
  if (price) {
    const value = num(price[1].replace(/[$€£\s]/g, '').replace(/k$/i, '000'));
    if (value >= 12000 && value <= 6_000_000) out.push({ kind: 'price', label: `From ${price[1].replace(/\s/g, '')}` });
  }

  const top = t.match(/top speed (?:of |is |will be |reaches |limited to )?(?:around |about |nearly |over |roughly |an? )?(\d{2,3})\s?(mph|km\/h|kph)/i) ?? t.match(/(\d{2,3})\s?(mph|km\/h|kph)\s?top speed/i);
  if (top && num(top[1]) >= 80 && num(top[1]) <= 330) out.push({ kind: 'topspeed', label: `${top[1]} ${top[2].toLowerCase() === 'mph' ? 'mph' : 'km/h'} top speed` });

  // Layout / engine.
  const engine = t.match(/\b(twin-turbo(?:charged)?\s(?:V\d{1,2}|flat-six|inline-six)|V12|V10|V8|V6|flat-six|inline-six|plug-in hybrid|PHEV|hybrid|all-electric|fully electric|electric)\b/i);
  const drive = t.match(/\b(all-wheel[- ]drive|AWD|rear-wheel[- ]drive|RWD|front-wheel[- ]drive|FWD)\b/i);
  const driveLabel = drive ? (/all/i.test(drive[1]) || /awd/i.test(drive[1]) ? 'AWD' : /rear|rwd/i.test(drive[1]) ? 'RWD' : 'FWD') : '';
  const engineLabel = engine ? engine[1].replace(/^./, (c) => c.toUpperCase()).replace(/phev/i, 'Plug-in hybrid').replace(/all-electric|fully electric/i, 'Electric') : '';
  if (engineLabel || driveLabel) out.push({ kind: 'drive', label: [engineLabel, driveLabel].filter(Boolean).join(' · ') });

  return out.slice(0, 4);
}
