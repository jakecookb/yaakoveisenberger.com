// Vehicle classes and typical fee levels for the rental command center. Rates themselves come from the companies'
// own sites (none of them offers a public price API); fee defaults are typical U.S. levels and are editable, because
// every airport and city sets its own.

export type Company = 'hertz' | 'national' | 'avis';
export const COMPANIES: { id: Company; name: string; color: string; url: string; codeLabel: string; codeHint: string }[] = [
  { id: 'hertz', name: 'Hertz', color: '#facc15', url: 'https://www.hertz.com/us/en', codeLabel: 'CDP code', codeHint: 'Hertz is AAA’s rental partner — enter your AAA membership number on Hertz’s site with the AAA CDP code shown on your AAA card or account.' },
  { id: 'national', name: 'National', color: '#22c55e', url: 'https://www.nationalcar.com/en/home.html', codeLabel: 'Contract ID', codeHint: 'Use an Emerald Club number and any corporate/association contract ID you’re eligible for.' },
  { id: 'avis', name: 'Avis', color: '#ef4444', url: 'https://www.avis.com/en/home', codeLabel: 'AWD code', codeHint: 'An Avis Worldwide Discount (AWD) number from your employer or an association you belong to.' },
];

export type VClass = 'sedan' | 'fullsize' | 'luxury' | 'suv' | 'van' | 'truck';
export const CLASS_LABEL: Record<VClass, string> = { sedan: 'Sedans', fullsize: 'Full-size', luxury: 'Luxury', suv: 'SUVs', van: 'Vans', truck: 'Trucks' };

export type Feature = 'awd' | 'leather' | 'carplay' | 'thirdRow' | 'adaptiveCruise' | 'towing' | 'premiumAudio' | 'hybrid';
export const FEATURE_LABEL: Record<Feature, string> = {
  awd: 'AWD / 4x4', leather: 'Leather', carplay: 'CarPlay / Android Auto', thirdRow: '3rd row', adaptiveCruise: 'Adaptive cruise', towing: 'Tow package', premiumAudio: 'Premium audio', hybrid: 'Hybrid option',
};

export interface Vehicle {
  id: string;
  cls: VClass;
  name: string;
  examples: string; // "or similar" models — the exact car isn't guaranteed
  passengers: number;
  bags: { large: number; small: number };
  features: Feature[];
}

// Typical models in each class across the three companies (each guarantees the class, not the model).
export const VEHICLES: Vehicle[] = [
  { id: 'midsize', cls: 'sedan', name: 'Midsize sedan', examples: 'Toyota Corolla, Nissan Sentra, Hyundai Elantra', passengers: 5, bags: { large: 1, small: 2 }, features: ['carplay', 'hybrid'] },
  { id: 'standard', cls: 'sedan', name: 'Standard sedan', examples: 'Volkswagen Jetta, Kia K5', passengers: 5, bags: { large: 2, small: 1 }, features: ['carplay'] },
  { id: 'fullsize', cls: 'fullsize', name: 'Full-size sedan', examples: 'Toyota Camry, Nissan Altima, Chevrolet Malibu', passengers: 5, bags: { large: 2, small: 2 }, features: ['carplay', 'adaptiveCruise', 'hybrid'] },
  { id: 'premium', cls: 'fullsize', name: 'Premium sedan', examples: 'Nissan Maxima, Chrysler 300, Kia K5 GT-Line', passengers: 5, bags: { large: 2, small: 2 }, features: ['carplay', 'leather', 'adaptiveCruise'] },
  { id: 'luxury', cls: 'luxury', name: 'Luxury sedan', examples: 'Cadillac CT5, BMW 3/5 Series, Mercedes C-Class', passengers: 5, bags: { large: 2, small: 2 }, features: ['leather', 'carplay', 'adaptiveCruise', 'premiumAudio', 'awd'] },
  { id: 'lux-suv', cls: 'luxury', name: 'Luxury SUV', examples: 'Cadillac Escalade, Lincoln Navigator, BMW X5', passengers: 7, bags: { large: 4, small: 2 }, features: ['leather', 'carplay', 'adaptiveCruise', 'premiumAudio', 'awd', 'thirdRow'] },
  { id: 'mid-suv', cls: 'suv', name: 'Midsize SUV', examples: 'Toyota RAV4, Nissan Rogue, Ford Escape', passengers: 5, bags: { large: 2, small: 2 }, features: ['awd', 'carplay', 'adaptiveCruise', 'hybrid'] },
  { id: 'std-suv', cls: 'suv', name: 'Standard SUV', examples: 'Ford Edge, Jeep Grand Cherokee, Nissan Murano', passengers: 5, bags: { large: 3, small: 2 }, features: ['awd', 'carplay', 'adaptiveCruise'] },
  { id: 'full-suv', cls: 'suv', name: 'Full-size SUV', examples: 'Chevrolet Tahoe, Ford Expedition, GMC Yukon', passengers: 7, bags: { large: 4, small: 3 }, features: ['awd', 'carplay', 'thirdRow', 'towing', 'adaptiveCruise'] },
  { id: 'minivan', cls: 'van', name: 'Minivan', examples: 'Chrysler Pacifica, Toyota Sienna, Kia Carnival', passengers: 7, bags: { large: 3, small: 3 }, features: ['carplay', 'thirdRow', 'hybrid'] },
  { id: 'passenger-van', cls: 'van', name: '12/15-passenger van', examples: 'Ford Transit Passenger', passengers: 12, bags: { large: 4, small: 4 }, features: ['carplay'] },
  { id: 'pickup', cls: 'truck', name: 'Pickup truck', examples: 'Ford F-150, Ram 1500, Chevrolet Silverado', passengers: 5, bags: { large: 3, small: 2 }, features: ['awd', 'towing', 'carplay'] },
];

/** Typical U.S. fee levels — always check your actual quote; airports and cities set their own. */
export interface Fees {
  taxPct: number; // state + local sales tax on the rental
  airportPct: number; // airport concession recovery fee (airport pick-ups only)
  facilityPerDay: number; // customer facility charge, $/day (airport pick-ups only)
  vlfPerDay: number; // vehicle licence / registration recovery, $/day
  otherFlat: number; // energy surcharge, tire/battery fees etc., per rental
  oneWayFee: number; // drop-off at a different location
}
export const DEFAULT_FEES: Fees = { taxPct: 8, airportPct: 11.1, facilityPerDay: 6, vlfPerDay: 2, otherFlat: 3, oneWayFee: 0 };

export interface Quote { daily: number; discountPct: number }

export function total(q: Quote, days: number, airport: boolean, oneWay: boolean, f: Fees) {
  const base = q.daily * days * (1 - q.discountPct / 100);
  const airportFee = airport ? (base * f.airportPct) / 100 : 0;
  const facility = airport ? f.facilityPerDay * days : 0;
  const vlf = f.vlfPerDay * days;
  const other = f.otherFlat + (oneWay ? f.oneWayFee : 0);
  const taxable = base + airportFee + vlf + other;
  const tax = (taxable * f.taxPct) / 100;
  return { base, airportFee, facility, vlf, other, tax, total: base + airportFee + facility + vlf + other + tax };
}
