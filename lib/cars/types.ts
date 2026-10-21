export interface CarSpec {
  kind: 'power' | 'speed' | 'range' | 'battery' | 'price' | 'drive' | 'topspeed' | 'caliber' | 'capacity' | 'barrel' | 'blade' | 'steel' | 'weight';
  label: string;
}

export interface CarItem {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  image?: string;
  source: string;
  publishedAt: string; // ISO
  tags: string[];
  specs: CarSpec[];
  score: number;
}

export interface CarSource {
  id: string;
  name: string;
  feed: string;
  home: string;
}
