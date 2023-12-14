import tty from 'node:tty';

import { ColorDefineUtil } from './color-define';
import {
  RGBInput, TermColorFn, TermColorLevel, TermColorPalette,
  TermColorPaletteInput, TermColorScheme, TermStyle, TermStyleInput
} from './color-types';

const ESC = '\x1b[';
const COLOR_LEVEL_MAP = { 1: 0, 4: 1, 8: 2, 24: 3 } as const;
type ColorBits = keyof (typeof COLOR_LEVEL_MAP);
type Prim = Parameters<TermColorFn>[0];

const TypedObject: {
  entries<K extends Record<symbol | string, unknown>>(record: K): [keyof K, K[keyof K]][];
} & ObjectConstructor = Object;

/**
 * Utils for colorizing output
 */
export class ColorOutputUtil {

  static #scheme: {
    key: string;
    value: TermColorScheme;
  } = { key: '', value: 'dark' };

  static #level: {
    key: string;
    value: TermColorLevel;
  } = { key: '', value: 0 };

  /**
   * Detect color level from tty information
   */
  static readTermColorLevel(stream: tty.WriteStream = process.stdout): TermColorLevel {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const depth: ColorBits | undefined = stream.isTTY ? stream.getColorDepth() as ColorBits : undefined;
    const force = process.env.FORCE_COLOR;
    const disable = process.env.NO_COLOR ?? process.env.NODE_DISABLE_COLORS;

    const key = [force, disable, depth].join('|');
    if (this.#level.key === key) {
      return this.#level.value;
    }

    let value: TermColorLevel | undefined = undefined;
    if (force !== undefined) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      value = Math.max(Math.min(/^\d+$/.test(force) ? parseInt(force, 10) : 1, 3), 0) as TermColorLevel;
    } else if (disable !== undefined && /^(1|true|yes|on)$/i.test(disable)) {
      value = 0;
    }
    value ??= depth ? COLOR_LEVEL_MAP[depth] : 0;
    Object.assign(this.#level, { key, value });
    return value;
  }

  /**
   * Read foreground/background color if env var is set
   */
  static readBackgroundScheme(): TermColorScheme {
    const key = process.env.COLORFGBG ?? '';

    if (this.#scheme.key === key) {
      return this.#scheme.value;
    }

    const [, bg] = key.split(';');
    const color = (bg ? ColorDefineUtil.rgbFromAnsi256(+bg) : undefined) ?? [0, 0, 0];
    const hex = `#${color.map(x => x.toString(16).padStart(2, '0')).join('')}` as const;
    const value = ColorDefineUtil.defineColor(hex).scheme;
    Object.assign(this.#scheme, { key, value });
    return value;
  }

  /**
   * Get styled pair
   */
  static getStyledPair(inp: TermStyle | RGBInput, level: TermColorLevel): [string, string] {
    if (level === 0) {
      return ['', ''];
    }

    const cfg = (typeof inp !== 'object') ? { text: inp } : inp;
    const text = cfg.text ? ColorDefineUtil.getColorCodes(cfg.text, false) : undefined;
    const bg = cfg.background ? ColorDefineUtil.getColorCodes(cfg.background, true) : undefined;

    const prefix: number[] = [];
    const suffix: number[] = [];
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    for (const key of Object.keys(cfg) as (keyof typeof cfg)[]) {
      if (!cfg[key]) {
        continue;
      }
      switch (key) {
        case 'inverse': prefix.push(7); suffix.push(27); break;
        case 'underline': prefix.push(4); suffix.push(24); break;
        case 'italic': prefix.push(3); suffix.push(23); break;
        case 'blink': prefix.push(5); suffix.push(25); break;
        case 'text': prefix.push(...text![level][0]); suffix.push(...text![level][1]); break;
        case 'background': prefix.push(...bg![level][0]); suffix.push(...bg![level][1]); break;
      }
    }
    return [
      `${ESC}${prefix.join(';')}m`,
      `${ESC}${suffix.reverse().join(';')}m`,
    ];
  }

  /**
   * Make a simple primitive colorer
   */
  static colorer(style: TermStyleInput | [dark: TermStyleInput, light: TermStyleInput]): TermColorFn {
    const scheme = this.readBackgroundScheme();
    const level = this.readTermColorLevel();
    const flat = Array.isArray(style) ? style : [style];

    const [prefix, suffix] = this.getStyledPair((scheme === 'light' ? flat[1] : undefined) ?? flat[0], level);
    return (v: Prim): string => (v === undefined || v === null) ? '' : `${prefix}${v}${suffix}`;
  }

  /**
   * Creates a color palette based on input styles
   */
  static palette<P extends TermColorPaletteInput>(input: P): TermColorPalette<P> {
    // Common color support
    const out: Partial<TermColorPalette<P>> = {};
    for (const [k, col] of TypedObject.entries(input)) {
      out[k] = this.colorer(col);
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return out as TermColorPalette<P>;
  }

  /**
   * Convenience method to creates a color template function based on input styles
   */
  static templateFunction<P extends TermColorPaletteInput>(input: P): (key: keyof P, val: Prim) => string {
    const pal = this.palette(input);
    return (key: keyof P, val: Prim) => pal[key](val);
  }
}