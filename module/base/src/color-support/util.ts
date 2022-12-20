import { Env } from '../env';
import { TypedObject } from '../types';

export type ColorLevel = 0 | 1 | 2 | 3;

export type Prim = string | number | boolean | Date;
export type TemplateType<T> = (values: TemplateStringsArray, ...keys: (Partial<Record<keyof T, Prim>> | string)[]) => string;
export type ColorFn = (text: Prim) => string;
export type ColorPalette<T> = Record<keyof T, ColorFn>;
export type TextStyle<T extends string = string, B extends string = string> =
  { text?: T, background?: B, italic?: boolean, underline?: boolean, inverse?: boolean };
export type StyleInput<T extends string = string> = T | TextStyle;

type I = number;
export type NamedColorInput = [idx24bit: I, idx256: I, idx16: I] | readonly [idx24bit: I, idx256: I, idx16: I];
export type NamedColor = {
  codes: Record<'text' | 'background', ['', [I, I], [string, I], [string, I]]>;
  parts: { h: I, s: I, l: I, r: I, g: I, b: I };
};

const STYLES = {
  italic: [3, 23],
  underline: [4, 24],
  inverse: [7, 27]
};

const TEXT_STYLE_KEYS = ['text', 'background'] as const;

const STYLE_KEYS = TypedObject.keys(STYLES);

/**
 * Terminal support for colorizing text
 */
export class ColorUtil {
  /**
   * Convert rgb into r/g/b channels
   */
  static toRgbParts(rgb: number): [number, number, number] {
    // eslint-disable-next-line no-bitwise
    return [(rgb >> 16) & 255, (rgb >> 8) & 255, (rgb) & 255];
  }

  /**
   * Convert [r,g,b] to {h,s,l}
   */
  static hsl(r: number, g: number, b: number): { h: number, s: number, l: number } {
    const [rf, gf, bf] = (r > 1 || g > 1 || b > 1) ? [r / 255, g / 255, b / 255] : [r, g, b];
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
    return { h, s, l };
  }

  /**
   * Build named color pair
   */
  static makeNamedColor([rgb, idx5, idx1]: NamedColorInput): NamedColor {
    const [r, g, b] = this.toRgbParts(rgb);
    return {
      codes: {
        text: ['', [idx1, 39], [`38;5;${idx5}`, 39], [`38;2;${r};${g};${b}`, 39]],
        background: ['', [idx1 + 10, 49], [`48;5;${idx5}`, 49], [`48;2;${r};${g};${b}`, 49]]
      },
      parts: { r, g, b, ...this.hsl(r, g, b) }
    };
  }

  /**
   * Detect color level
   */
  static detectLevel(): ColorLevel {
    const supported = Env.isTrue('FORCE_COLOR') || (!Env.isTrue('NO_COLOR') && process.stdout.isTTY);
    if (supported) {
      return /truecolor|24/i.test(Env.get('COLORTERM', '')) ? 3 :
        (/-256(color)?$/i.test(Env.get('TERM', '')) ? 2 : 1);
    } else {
      return 0;
    }
  }

  /**
   * Build colorer pairs for all levels
   */
  static makeColorer(namedColors: Record<string, NamedColor>, cfg: TextStyle | string): ColorFn[] {
    if (typeof cfg === 'string') {
      cfg = { text: cfg };
    }
    const fns: ColorFn[] = [];
    for (const level of [0, 1, 2, 3]) {
      const prefix: (string | number)[] = [];
      const suffix: (string | number)[] = [];
      if (level > 0) {
        for (const key of STYLE_KEYS) {
          if (cfg[key]) {
            const [open, close] = STYLES[key];
            prefix.push(open);
            suffix.push(close);
          }
        }
        for (const key of TEXT_STYLE_KEYS) {
          if (cfg[key]) {
            const [open, close] = namedColors[cfg[key]!].codes[key][level];
            prefix.push(open);
            suffix.unshift(close);
          }
        }
      }
      const prefixStr = `\x1b[${prefix.join(';')}m`;
      const suffixStr = `\x1b[${suffix.join(';')}m`;
      fns.push(v => (v === undefined || v === null) ? '' : `${prefixStr}${v}${suffixStr}`);
    }
    return fns;
  }

  /**
   * Creates a string interpolator for a given palette
   *
   * @param palette The list of supported keys for the string template
   */
  static makeTemplate<T>(palette: ColorPalette<T>): TemplateType<T> {
    /**
     * @example
     * ```
     * color`${{title: 'Main Title'}} is ${{subtitle: 'Sub Title'}}`
     * ```
     */
    return (values: TemplateStringsArray, ...keys: (Partial<Record<keyof T, Prim>> | string)[]) => {
      if (keys.length === 0) {
        return values[0];
      } else {
        const out = keys.map((el, i) => {
          if (typeof el !== 'string') {
            const subKeys = TypedObject.keys(el);
            if (subKeys.length !== 1) {
              throw new Error('Invalid template variable, one and only one key should be specified');
            }
            const k = subKeys[0];
            el = palette[k](el[k]!)!;
          }
          return `${values[i] ?? ''}${el ?? ''}`;
        });
        if (values.length > keys.length) {
          out.push(values[values.length - 1]);
        }
        return out.join('');
      }
    };
  }
}