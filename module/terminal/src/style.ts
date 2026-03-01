import chalk from 'chalk';

import { Env, TypedObject } from '@travetto/runtime';

type TemplatePrim = number | string | bigint | boolean | RegExp;
type Color = `#${string}`;
export type TermStyleInput = Color | { text: Color, background?: Color, inverse?: boolean, bold?: boolean, italic?: boolean, underline?: boolean };
type TermStylePairInput = [dark: TermStyleInput, light?: TermStyleInput] | readonly [dark: TermStyleInput, light?: TermStyleInput];
export type TermStyleFn = (input: TemplatePrim) => string;
export type TermStyledTemplate<T extends string> = (values: TemplateStringsArray, ...keys: (Partial<Record<T, TemplatePrim>> | string)[]) => string;
export type ColorLevel = 0 | 1 | 2 | 3;

const ANSI_16_RGB: [number, number, number][] = [
  [0, 0, 0], [128, 0, 0], [0, 128, 0], [128, 128, 0],
  [0, 0, 128], [128, 0, 128], [0, 128, 128], [192, 192, 192],
  [128, 128, 128], [255, 0, 0], [0, 255, 0], [255, 255, 0],
  [0, 0, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255]
];

const toLinear = (v: number): number => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const ESC = '\x1b';

export class StyleUtil {

  /** Compute RGB values for ANSI 256 color code */
  static computeRGBForAnsi256(code: number): [number, number, number] {
    if (code < 16) {
      return ANSI_16_RGB[code];
    } else if (code <= 231) {
      const cubeIdx = code - 16;
      const levels = [0, 95, 135, 175, 215, 255];
      const ri = Math.floor(cubeIdx / 36);
      const gi = Math.floor((cubeIdx % 36) / 6);
      const bi = cubeIdx % 6;
      return [levels[ri], levels[gi], levels[bi]];
    } else {
      const gray = 8 + (code - 232) * 10;
      return [gray, gray, gray];
    }
  }

  /** Compute Luminosity for ANSI 256 color code */
  static computeAnsi256Luminosity(code: number): number {
    const [r, g, b] = this.computeRGBForAnsi256(code);
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  }

  static #scheme: { key: string, dark: boolean } = { key: '', dark: true };

  /**
   * Create text render function from style input using current color levels
   */
  static getStyle(input: TermStyleInput): TermStyleFn {
    if (typeof input === 'string') {
      return chalk.hex(input);
    } else {
      let style = chalk;
      for (const key of TypedObject.keys(input)) {
        switch (key) {
          case 'text': style = style.hex(input[key]!); break;
          case 'background': style = style.bgHex(input[key]!); break;
          default: style = (input[key] ? style[key] : style); break;
        }
      }
      return style;
    }
  }

  /**
   * Read foreground/background color if env var is set
   */
  static isBackgroundDark(): boolean {
    const key = Env.COLORFGBG.value ?? '';

    if (this.#scheme.key === key) {
      return this.#scheme.dark;
    }

    const [, bg = '0'] = key.split(';');
    const dark = this.computeAnsi256Luminosity(+bg) < 0.4;
    Object.assign(this.#scheme, { key, dark });
    return dark;
  }

  /**
   * Create renderer from input source
   */
  static getThemedStyle(input: TermStylePairInput): TermStyleFn {
    const [dark, light] = input;
    const isDark = this.isBackgroundDark();
    return isDark ? this.getStyle(dark) : this.getStyle(light ?? dark);
  }

  /**
   * Is styling currently enabled
   */
  static get enabled(): boolean {
    return chalk.level > 0;
  }

  /**
   * Build style palette, with support for background theme awareness
   */
  static getPalette<K extends string>(input: Record<K, TermStylePairInput>): Record<K, TermStyleFn> {
    return TypedObject.fromEntries(
      TypedObject.entries(input).map(([key, value]) => [key, this.getThemedStyle(value)]));
  }

  /**
   * Make a template function based on the input set
   */
  static getTemplate<K extends string>(input: Record<K, TermStylePairInput>): TermStyledTemplate<K> {
    const palette = this.getPalette(input);

    return (values: TemplateStringsArray, ...keys: (Partial<Record<K, TemplatePrim>> | string)[]) => {
      if (keys.length === 0) {
        return values[0];
      } else {
        const out = keys.map((item, i) => {
          let final = item;
          if (typeof item !== 'string') {
            const subKeys = TypedObject.keys(item);
            if (subKeys.length !== 1) {
              throw new Error('Invalid template variable, one and only one key should be specified');
            }
            const [key] = subKeys;
            const value = item[key]!;
            final = value === undefined ? '' : palette[key](value)!;
          }
          return `${values[i] ?? ''}${final ?? ''}`;
        });
        if (values.length > keys.length) {
          out.push(values.at(-1)!);
        }
        return out.join('');
      }
    };
  }

  /** Make a URL link */
  static link(text: string, url: string): string {
    return `${ESC}]8;;${url}${ESC}\\${text}${ESC}]8;;${ESC}\\`;
  }
}