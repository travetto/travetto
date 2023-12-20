import { Env } from './env';
import { Primitive, TypedObject } from './types';
import { TemplateType, Util } from './util';

type Fn = (text: string) => string;

export class ColorUtil {

  static DARK_ANSI_256 = new Set([
    0, 1, 2, 3, 4, 5, 6, 16, 17, 18, 19, 20, 22, 23, 24, 25, 26, 28, 29, 30, 31, 32, 34, 35, 36, 37, 38, 40, 41, 42, 43, 44, 52, 53, 54,
    55, 56, 58, 59, 60, 64, 65, 66, 70, 76, 88, 89, 90, 91, 92, 94, 95, 96, 100, 101, 106, 112, 124, 125, 126, 127, 128, 130, 136, 142,
    148, 160, 161, 162, 163, 164, 166, 172, 178, 184, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243
  ]);

  static VERY_LIGHT_ANSI_256 = new Set([
    7, 15, 105, 111, 117, 120, 121, 122, 123, 141, 146, 147, 151, 152, 153, 156, 157, 158, 159, 177, 181, 182, 183, 187, 188, 189, 192,
    193, 194, 195, 210, 211, 212, 213, 216, 217, 218, 219, 222, 223, 224, 225, 228, 229, 230, 231, 250, 251, 252, 253, 254, 255,
  ]);

  static #scheme: { key: string, dark: boolean } = { key: '', dark: true };

  /**
   * Read foreground/background color if env var is set
   */
  static isBackgroundDark(): boolean {
    const key = Env.COLORFGBG.val ?? '';

    if (this.#scheme.key === key) {
      return this.#scheme.dark;
    }

    const [, bg = '0'] = key.split(';');
    const dark = this.DARK_ANSI_256.has(+bg);
    Object.assign(this.#scheme, { key, dark });
    return dark;
  }

  /**
   * Build color palette, with support for background-color awareness
   */
  static palette<K extends string>(inp: Record<K, Fn | [Fn, Fn]>): (key: K, text: Exclude<Primitive, Error> | RegExp) => string {
    const isDark = this.isBackgroundDark();
    for (const k of TypedObject.keys(inp)) {
      const val = inp[k];
      if (Array.isArray(val)) {
        inp[k] = isDark ? val[0] : val[1];
      }
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return (key, text): string => text === undefined ? '' : (inp[key] as Fn)(`${text}`);
  }

  /**
   * Make a template function based on the input set
   */
  static makeTemplate<K extends string>(inp: Record<K, Fn | [Fn, Fn]>): TemplateType<K> {
    return Util.makeTemplate(this.palette(inp));
  }
}