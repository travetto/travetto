import chalk from 'chalk';

import { Env, TypedObject, Primitive } from '@travetto/base';

type TemplatePrim = Primitive | RegExp;
type Color = `#${string}`;
export type TermStyleInput = Color | { text: Color, background?: Color, inverse?: boolean, bold?: boolean, italic?: boolean, underline?: boolean };
type TermStylePairInput = TermStyleInput | [dark: TermStyleInput, light: TermStyleInput];
export type TermStyleFn = (input: TemplatePrim) => string;
type TermStyledTemplate<T extends string> = (values: TemplateStringsArray, ...keys: (Partial<Record<T, TemplatePrim>> | string)[]) => string;

// eslint-disable-next-line no-control-regex
const ANSI_CODE_REGEX = /(\x1b|\x1B)[\[\]][?]?[0-9;]+[A-Za-z]/g;

export class ColorUtil {

  static #darkAnsi256 = new Set([
    0, 1, 2, 3, 4, 5, 6, 16, 17, 18, 19, 20, 22, 23, 24, 25, 26, 28, 29, 30, 31, 32, 34, 35, 36, 37, 38, 40, 41, 42, 43, 44, 52, 53, 54,
    55, 56, 58, 59, 60, 64, 65, 66, 70, 76, 88, 89, 90, 91, 92, 94, 95, 96, 100, 101, 106, 112, 124, 125, 126, 127, 128, 130, 136, 142,
    148, 160, 161, 162, 163, 164, 166, 172, 178, 184, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243
  ]);

  static #scheme: { key: string, dark: boolean } = { key: '', dark: true };

  /**
   * Create text render function from style input using current color levels
   */
  static fromStyle(input: TermStyleInput): TermStyleFn {
    if (typeof input === 'string') {
      return chalk.hex(input);
    } else {
      let style: chalk.Chalk = chalk;
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
    const key = Env.COLORFGBG.val ?? '';

    if (this.#scheme.key === key) {
      return this.#scheme.dark;
    }

    const [, bg = '0'] = key.split(';');
    const dark = this.#darkAnsi256.has(+bg);
    Object.assign(this.#scheme, { key, dark });
    return dark;
  }

  /**
   * Create renderer from input source
   */
  static fromInput(input: TermStylePairInput): TermStyleFn {
    const [dark, light] = (Array.isArray(input) ? input : [input]);
    const isDark = this.isBackgroundDark();
    return isDark ? this.fromStyle(dark) : this.fromStyle(light ?? dark);
  }

  /**
   * Get the current color level
   */
  static get level(): 0 | 1 | 2 | 3 {
    return chalk.level;
  }

  /**
   * Build color palette, with support for background-color awareness
   */
  static styleMap<K extends string>(inp: Record<K, TermStylePairInput>): Record<K, TermStyleFn> {
    return TypedObject.fromEntries(
      TypedObject.entries(inp).map(([k, v]) => [k, this.fromInput(v)]));
  }

  /**
   * Make a template function based on the input set
   */
  static makeTemplate<K extends string>(input: Record<K, TermStylePairInput>): TermStyledTemplate<K> {
    const palette = this.styleMap(input);

    return (values: TemplateStringsArray, ...keys: (Partial<Record<K, TemplatePrim>> | string)[]) => {
      if (keys.length === 0) {
        return values[0];
      } else {
        const out = keys.map((el, i) => {
          let final = el;
          if (typeof el !== 'string') {
            const subKeys = TypedObject.keys(el);
            if (subKeys.length !== 1) {
              throw new Error('Invalid template variable, one and only one key should be specified');
            }
            const [k] = subKeys;
            const v = el[k]!;
            final = v === undefined ? '' : palette[k](v)!;
          }
          return `${values[i] ?? ''}${final ?? ''}`;
        });
        if (values.length > keys.length) {
          out.push(values[values.length - 1]);
        }
        return out.join('');
      }
    };
  }

  /**
   * Remove color escape sequences
   */
  static removeColor(text: string): string {
    return text.replace(ANSI_CODE_REGEX, '');
  }
}