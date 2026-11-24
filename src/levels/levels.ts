import raw from '../../levels/levels.json';

export type Color = 'r' | 'b' | 'g';
export type LayoutId = 'row3' | 'g23' | 'zig6' | 'g33' | 'ring9';

export interface Layout { r: number; pts: [number, number][] }

/** Ring positions in the 360×500 board space (must match tools/gen.js). */
export const LAYOUTS: Record<LayoutId, Layout> = {
  row3: { r: 60, pts: [[110, 210], [180, 210], [250, 210]] },
  g23: { r: 58, pts: [[95, 170], [180, 170], [265, 170], [95, 270], [180, 270], [265, 270]] },
  zig6: { r: 56, pts: [[80, 150], [150, 200], [220, 150], [290, 200], [150, 290], [220, 290]] },
  g33: { r: 54, pts: [[100, 120], [180, 120], [260, 120], [100, 210], [180, 210], [260, 210], [100, 300], [180, 300], [260, 300]] },
  ring9: { r: 52, pts: [[180, 100], [255, 135], [285, 210], [255, 285], [180, 320], [105, 285], [75, 210], [105, 135], [180, 210]] },
};

export interface LevelSpec {
  layout: LayoutId;
  colors: Color[];
  /** gap angle per ring, degrees */
  gaps: number[];
  /** [ringIndex, angleDegrees] */
  pins: [number, number][];
  role: string;
  minMoves: number;
  moves: number;
}

export const LEVELS = raw as unknown as LevelSpec[];

export const ROLE_NAMES_TR: Record<string, string> = {
  'Öğretici': 'Öğretici', 'Öğretici: tepsi': 'Öğretici', 'Yeni: pim': 'Yeni mekanik', 'Normal': 'Normal',
  'Zor': 'Zor', 'Dinlenme': 'Rahat', 'Normal+': 'Normal', 'Süper zor': 'Süper zor',
};

export const HINTS_TR: Record<string, string> = {
  'Öğretici': 'Bir halkayı parmağınla çevir. Boşluğunu komşu halkayla kesiştiği noktaya getir. Parlayan halka serbesttir: ona dokun.',
  'Öğretici: tepsi': 'Aynı renkten 3 charm tepside birleşir. 5 yuva dolarsa kaybedersin. Her çevirme 1 hamle; dokunmak bedava.',
  'Yeni: pim': 'Yeni: altın pim! Pimli halka, boşluğu pimin üstüne gelmeden çıkmaz.',
  'Normal': 'Hamlelerini say: önce hangi halkayı çevirirsen diğerlerinin de yolu açılır?',
  'Zor': 'Zor seviye! Üç renk var; tepsiyi dolduracak sırayla çıkarma.',
  'Dinlenme': 'Nefes al: rahat bir bileklik.',
  'Normal+': 'Halka kolye: ortadaki halka herkese bağlı.',
  'Süper zor': 'Süper zor! Hamle payı yok: her çevirme doğru olmalı.',
};
