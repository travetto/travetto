import chalk from 'chalk';

import { Env, TypedObject } from '@travetto/runtime';

type TemplatePrim = number | string | bigint | boolean | RegExp;
type Color = `#${string}`;
export type TermStyleInput = Color | { text: Color, background?: Color, inverse?: boolean, bold?: boolean, italic?: boolean, underline?: boolean };
type TermStylePairInput = TermStyleInput | [dark: TermStyleInput, light: TermStyleInput];
export type TermStyleFn = (input: TemplatePrim) => string;
type TermStyledTemplate<T extends string> = (values: TemplateStringsArray, ...keys: (Partial<Record<T, TemplatePrim>> | string)[]) => string;
export type ColorLevel = 0 | 1 | 2 | 3;

const DARK_ANSI_256 = new Set([
  0, 1, 2, 3, 4, 5, 6, 16, 17, 18, 19, 20, 22, 23, 24, 25, 26, 28, 29, 30, 31, 32, 34, 35, 36, 37, 38, 40, 41, 42, 43, 44, 52, 53, 54,
  55, 56, 58, 59, 60, 64, 65, 66, 70, 76, 88, 89, 90, 91, 92, 94, 95, 96, 100, 101, 106, 112, 124, 125, 126, 127, 128, 130, 136, 142,
  148, 160, 161, 162, 163, 164, 166, 172, 178, 184, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243
]);

export class StyleUtil {

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
    const dark = DARK_ANSI_256.has(+bg);
    Object.assign(this.#scheme, { key, dark });
    return dark;
  }

  /**
   * Create renderer from input source
   */
  static getThemedStyle(input: TermStylePairInput): TermStyleFn {
    const [dark, light] = (Array.isArray(input) ? input : [input]);
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
  static getPalette<K extends string>(inp: Record<K, TermStylePairInput>): Record<K, TermStyleFn> {
    return TypedObject.fromEntries(
      TypedObject.entries(inp).map(([key, value]) => [key, this.getThemedStyle(value)]));
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

}