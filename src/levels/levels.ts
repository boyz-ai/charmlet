import raw from '../../levels/levels.json';

export type Color = 'r' | 'b' | 'g';
export type LayoutId = 'row3' | 'g23' | 'zig6' | 'zig6m' | 'tri6' | 'hex6' | 'g33' | 'ring9' | 'zz9';

export interface Layout { r: number; pts: [number, number][] }

const HEX = [...Array(6)].map((_, k): [number, number] => [
  Math.round(180 + 85 * Math.cos((k * Math.PI) / 3 - Math.PI / 2)),
  Math.round(210 + 85 * Math.sin((k * Math.PI) / 3 - Math.PI / 2)),
]);

/** Ring positions in the 360×500 board space (must match tools/gen.cjs). */
export const LAYOUTS: Record<LayoutId, Layout> = {
  row3: { r: 60, pts: [[110, 210], [180, 210], [250, 210]] },
  g23: { r: 58, pts: [[95, 170], [180, 170], [265, 170], [95, 270], [180, 270], [265, 270]] },
  zig6: { r: 56, pts: [[80, 150], [150, 200], [220, 150], [290, 200], [150, 290], [220, 290]] },
  /** mirror image of zig6 (used by the mirrored levels 551–1000) */
  zig6m: { r: 56, pts: [[280, 150], [210, 200], [140, 150], [70, 200], [210, 290], [140, 290]] },
  tri6: { r: 54, pts: [[180, 130], [140, 200], [220, 200], [100, 270], [180, 270], [260, 270]] },
  hex6: { r: 52, pts: HEX },
  g33: { r: 54, pts: [[100, 120], [180, 120], [260, 120], [100, 210], [180, 210], [260, 210], [100, 300], [180, 300], [260, 300]] },
  ring9: { r: 52, pts: [[180, 100], [255, 135], [285, 210], [255, 285], [180, 320], [105, 285], [75, 210], [105, 135], [180, 210]] },
  zz9: { r: 46, pts: [[52, 170], [116, 170], [180, 170], [244, 170], [308, 170], [84, 240], [148, 240], [212, 240], [276, 240]] },
};

export interface LevelSpec {
  layout: LayoutId;
  colors: Color[];
  /** gap angle per ring, degrees */
  gaps: number[];
  /** [ringIndex, angleDegrees] */
  pins: [number, number][];
  /** ring indices with mechanics */
  fixed?: number[];
  twin?: number[];
  lock?: number[];
  ice?: number[];
  role: string;
  /** solver-verified solution: [ring, gap angle in degrees] = rotate, [ring, null] = tap */
  sol?: [number, number | null][];
  minMoves: number;
  moves: number;
}

export const LEVELS = raw as unknown as LevelSpec[];
