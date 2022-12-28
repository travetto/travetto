
import { Env, TypedObject, Util } from '@travetto/base';
import { ColorDefineUtil, RGBInput } from './define';

export type ColorLevel = 0 | 1 | 2 | 3;
export type Prim = string | number | boolean | Date;
export type TemplateType<T> = (values: TemplateStringsArray, ...keys: (Partial<Record<keyof T, Prim>> | string)[]) => string;
export type ColorPaletteInput = Record<string, Style | RGBInput>;

export type Style =
  { text?: RGBInput, background?: RGBInput, italic?: boolean, underline?: boolean, inverse?: boolean, blink?: boolean };

/**
 * Support for colorizing text on the terminal
 */
export class TerminalColorUtil {

  /**
   * Detect color level
   */
  static detectColorLevel(): ColorLevel {
    const force: string = Env.get('FORCE_COLOR', '').toLowerCase();
    switch (force) {
      case 'on': case 'yes': case 'true': case '1': return 1;
      case '2': return 2;
      case '3': return 3;
    }

    if (process.stdout.isTTY && !Env.isTrue('NO_COLOR') && !Env.isTrue('NODE_DISABLE_COLORS')) {
      const colorTerm = Env.get('COLORTERM', '');
      const term = Env.get('TERM', '');
      return /truecolor|24/i.test(colorTerm) ? 3 :
        (/-256(color)?$/i.test(term) ? 2 : 1);
    } else {
      return 0;
    }
  }

  /**
   * Build ANSI compatible color codes by level
   */
  static getColorCodes(inp: RGBInput, key: 'text' | 'background'): [number[], number[]][] {
    const spec = ColorDefineUtil.defineColor(inp);
    const bg = key === 'background';
    const { idx16, idx16bg, idx256, rgb } = spec;
    const [open, close] = bg ? [48, 49] : [38, 39];
    return [
      [[], []],
      [[bg ? idx16bg : idx16], [close]],
      [[open, 5, idx256], [close]],
      [[open, 2, ...rgb], [close]]
    ];
  }

  /**
   * Get styled levels, 0-3
   */
  static getStyledLevels(inp: Style | RGBInput): [string, string][] {
    const cfg = Util.isPlainObject(inp) ? inp : { text: inp };
    const levelPairs: [string, string][] = [['', '']];
    const text = cfg.text ? this.getColorCodes(cfg.text, 'text') : undefined;
    const bg = cfg.background ? this.getColorCodes(cfg.background, 'background') : undefined;

    for (const level of [1, 2, 3]) {
      const prefix: number[] = [];
      const suffix: number[] = [];
      for (const key of TypedObject.keys(cfg)) {
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
      levelPairs[level] = [`\x1b[${prefix.join(';')}m`, `\x1b[${suffix.reverse().join(';')}m`];
    }
    return levelPairs;
  }

  /**
   * Creates a string interpolator for a given palette
   *
   * @param palette The list of supported keys for the string template
   */
  static makeTemplate<T extends ColorPaletteInput>(convert: (key: keyof T, val: Prim) => string): TemplateType<T> {
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
          let final = el;
          if (typeof el !== 'string') {
            const subKeys = TypedObject.keys(el);
            if (subKeys.length !== 1) {
              throw new Error('Invalid template variable, one and only one key should be specified');
            }
            const k = subKeys[0];
            final = convert(k, el[k]!)!;
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
}