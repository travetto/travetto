import { NAMED_COLORS } from './named-colors';

type I = number;
export type RGB = [r: I, g: I, b: I] | (readonly [r: I, g: I, b: I]);
type HSL = [h: I, s: I, l: I];
export type DefinedColor = { rgb: RGB, hsl: HSL, idx16: I, idx16bg: I, idx256: I };
export type RGBInput = I | keyof (typeof NAMED_COLORS) | `#${string}`;

const _rgb = (r: I, g: I = r, b: I = g): RGB => [r, g, b];

const STD_PRE = ['std', 'bright'] as const;
const STD_COLORS = ['Black', 'Red', 'Green', 'Yellow', 'Blue', 'Magenta', 'Cyan', 'White'] as const;

// eslint-disable-next-line no-bitwise
const toRgbArray = (val: number): RGB => [(val >> 16) & 255, (val >> 8) & 255, val & 255];

const ANSI256_TO_16_IDX = [30, 31, 32, 33, 34, 35, 36, 37, 90, 91, 92, 93, 94, 95, 96, 97];
const ANSI16_TO_BG = new Map(ANSI256_TO_16_IDX.map(x => [x, x + 10]));

// Inspired/sourced from: https://github.com/mina86/ansi_colours/blob/master/src/ansi256.rs
const ANSI256_GRAY_MAPPING = [
  [16, 5],
  [232, 9], [233, 10], [234, 10], [235, 10], [236, 10], [237, 10], [238, 10], [239, 10], [240, 8],
  [59, 5],
  [241, 7], [242, 10], [243, 9], [244, 9],
  [102, 5],
  [245, 6], [246, 10], [247, 10], [248, 9],
  [145, 5],
  [249, 6], [250, 10], [251, 10], [252, 9],
  [188, 5],
  [253, 6], [254, 10], [255, 14],
  [231, 9]
].flatMap(([v, r]) => new Array<number>(v).fill(r));

const STEPS_256 = [0, 95, 135, 175, 215, 255];

const ANSI256_TO_RGB: RGB[] = [
  ...STD_PRE.flatMap(p => STD_COLORS.map(c => NAMED_COLORS[`${p}${c}`]).map(toRgbArray)),
  ...STEPS_256.flatMap(r => STEPS_256.flatMap(g => STEPS_256.map(b => _rgb(r, g, b)))),
  ...new Array(24).fill(0).map((_, i) => _rgb(i * 10 + 8)) // Grays
];

// Pulled from: https://github.com/mina86/ansi_colours/blob/master/src/ansi256.rs
const RED_256_LEVELS = [38, 115, 155, 196, 235];
const GREEN_256_LEVELS = [38, 115, 155, 196, 235];
const BLUE_256_LEVELS = [35, 115, 155, 195, 235];

export class ColorDefineUtil {
  static CACHE = new Map<number | string, DefinedColor>();

  static #snapToLevel(levels: number[], val: number): number {
    for (let i = 0; i < levels.length; i += 1) {
      if (val < levels[i]) { return i; }
    }
    return levels.length;
  }

  // Returns luminance of given sRGB color.
  // Pulled from: https://github.com/mina86/ansi_colours/blob/master/src/ansi256.rs
  // eslint-disable-next-line no-bitwise
  static #luminance = ([r, g, b]: RGB): number => (((3567664 * r + 11998547 * g + 1211005 * b) + (1 << 23)) >> 24) & 255;

  // Pulled from: https://github.com/mina86/ansi_colours/blob/master/src/ansi256.rs
  static #distance = ([xr, xg, xb]: RGB, [yr, yg, yb]: RGB, sr = xr + yr): number =>
    (1024 + sr) * ((xr - yr) ** 2) + 2048 * ((xg - yg) ** 2) + (1534 - sr) * ((xb - yb) ** 2);

  static #snapToAnsi256Bands([r, g, b]: RGB): [idx: number, snapped: RGB] {
    const ri = this.#snapToLevel(RED_256_LEVELS, r);
    const gi = this.#snapToLevel(GREEN_256_LEVELS, g);
    const bi = this.#snapToLevel(BLUE_256_LEVELS, b);
    return [(ri * 36 + 16 + gi * 6 + bi), [STEPS_256[ri], STEPS_256[gi], STEPS_256[bi]]];
  }

  /**
   * Converts [R,G,B] to an ANSI 256 index
   */
  // Inspired/sourced from: https://github.com/mina86/ansi_colours/blob/master/src/ansi256.rs
  static ansi256FromRgb(rgb: RGB): number {
    const grayIdx = ANSI256_GRAY_MAPPING[this.#luminance(rgb)];
    const grayDist = this.#distance(rgb, ANSI256_TO_RGB[grayIdx]);
    const [snappedIdx, snapped] = this.#snapToAnsi256Bands(rgb);
    return this.#distance(rgb, snapped) < grayDist ? snappedIdx : grayIdx;
  }

  /**
   * Converts [R,G,B] to an ANSI 16 index
   */
  static ansi16FromRgb(rgb: RGB): number {
    let min = Number.MAX_SAFE_INTEGER;
    let minIdx = -1;
    for (let i = 0; i < 16; i += 1) {
      const dist = this.#distance(rgb, ANSI256_TO_RGB[i]);
      if (dist < min) {
        min = dist;
        minIdx = i;
      }
    }
    return ANSI256_TO_16_IDX[minIdx];
  }

  /**
   * Converts [R,G,B] to [H,S,L]
   */
  static hsl([r, g, b]: RGB): HSL {
    const [rf, gf, bf] = [r / 255, g / 255, b / 255];
    const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rf: h = (gf - bf) / d + (gf < bf ? 6 : 0); break;
        case gf: h = (bf - rf) / d + 2; break;
        case bf: h = (rf - gf) / d + 4; break;
      }
      h /= 6;
    }
    return [h, s, l];
  }


  /**
   * Converts input value into [R,G,B] output
   */
  static toRgb(val: RGBInput): RGB {
    if (typeof val === 'string') {
      if (val.startsWith('#')) {
        const res = val.match(/^#(?<rh>[a-f0-9]{2})(?<gh>[a-f0-9]{2})(?<bh>[a-f0-9]{2})$/i);
        if (res) {
          const { rh, gh, bh } = res.groups!;
          return [parseInt(rh, 16), parseInt(gh, 16), parseInt(bh, 16)];
        }
      } else if (val in NAMED_COLORS) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        return this.toRgb(NAMED_COLORS[val as keyof typeof NAMED_COLORS]);
      }
      throw new Error(`Unknown color format: ${val}`);
    } else if (typeof val === 'number') {
      return toRgbArray(val);
    } else {
      return val;
    }
  }

  /**
   * Define a color and all its parts
   */
  static defineColor(val: RGBInput): DefinedColor {
    if (!this.CACHE.has(val)) {
      const rgb = this.toRgb(val);
      const idx16 = this.ansi16FromRgb(rgb);
      const idx256 = this.ansi256FromRgb(rgb);
      const hsl = this.hsl(rgb);
      const idx16bg = ANSI16_TO_BG.get(idx16)!;
      this.CACHE.set(val, { rgb, idx16, idx16bg, idx256, hsl });
    }
    return this.CACHE.get(val)!;
  }

  /**
   * Build ANSI compatible color codes by level
   */
  static getColorCodes(inp: RGBInput, bg: boolean): [number[], number[]][] {
    const spec = this.defineColor(inp);
    const { idx16, idx16bg, idx256, rgb } = spec;
    const [open, close] = bg ? [48, 49] : [38, 39];
    return [
      [[], []],
      [[bg ? idx16bg : idx16], [close]],
      [[open, 5, idx256], [close]],
      [[open, 2, ...rgb], [close]]
    ];
  }
}