import { EnvUtil } from './env';

/**
 * Utilities for dealing with coloring console text
 */
export class ColorUtil {
  private static colorize: boolean;

  /**
   * Types of text styles
   */
  static STYLES = {
    // styles
    bold: [1, 22],
    faint: [2, 22],
    italic: [3, 23],
    underline: [4, 24],
    inverse: [7, 27],
  };

  /**
   * Types of color
   */
  static COLORS = {
    // grayscale
    white: [37, 39],
    black: [90, 39],
    // colors
    blue: [34, 39],
    cyan: [36, 39],
    green: [32, 39],
    magenta: [35, 39],
    red: [31, 39],
    yellow: [33, 39]
  };


  /**
   * Simple function for colorizing text
   *
   * Taken from masylum's fork (https://github.com/masylum/log4js-node)
   */
  static color(textColor: keyof typeof ColorUtil.COLORS, styles: (keyof typeof ColorUtil.STYLES)[], value: any): string {
    if (this.colorize === undefined) {
      this.colorize = EnvUtil.isSetTrueOrFalse('FORCE_COLOR', 'NO_COLOR', process.stdout.isTTY);
    }
    if (this.colorize && value !== undefined && value !== null && value !== '') {
      for (const style of [this.COLORS[textColor], ...styles.map(s => this.STYLES[s])]) {
        value = `\x1b[${style[0]}m${value}\x1b[${style[1]}m`;
      }
    }
    return value;
  }

  /**
   * Make a colorer
   */
  static makeColorer(textColor: keyof typeof ColorUtil.COLORS, ...styles: (keyof typeof ColorUtil.STYLES)[]) {
    return this.color.bind(this, textColor, styles);
  }

  /**
   * Creates a string interpolator for a given palette
   */
  static makeTemplate<T extends Record<string, (text: string) => string>>(palette: T) {
    /**
     * @example
     * ```
     * color`${{title: 'Main Title'}} is ${{subtitle: 'Sub Title}}`
     * ```
     */
    return (values: TemplateStringsArray, ...keys: (Partial<Record<keyof T, any>> | string)[]) => {
      if (keys.length === 0) {
        return values[0];
      } else {
        const out = keys.map((el, i) => {
          if (typeof el !== 'string') {
            const subKeys = Object.keys(el) as (keyof T)[];
            if (subKeys.length !== 1) {
              throw new Error('Invalid template variable, one and only one key should be specified');
            }
            const k = subKeys[0];
            el = palette[k](el[k]);
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