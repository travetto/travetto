import { EnvUtil } from './env';

type Prim = string | number | boolean | Date;

type TemplateType<T> = (values: TemplateStringsArray, ...keys: (Partial<Record<keyof T, Prim>> | string)[]) => string;

/**
 * Utilities for dealing with coloring console text
 */
export class ColorUtil {
  static #colorize: boolean;

  /**
   * Set colorization directly
   * @private
   */
  static set colorize(val: boolean) {
    this.#colorize = val;
  }

  /**
   * Get colorization status
   */
  static get colorize(): boolean {
    if (this.#colorize === undefined) {
      if (EnvUtil.isSet('TRV_COLOR')) {
        this.#colorize = EnvUtil.isTrue('TRV_COLOR');
      } else {
        this.#colorize = EnvUtil.isTrue('FORCE_COLOR') || (!EnvUtil.isTrue('NO_COLOR') && process.stdout.isTTY);
      }
    }
    return this.#colorize;
  }

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
   *
   * @param textColor Text color
   * @param styles Text styles to apply
   * @param value The value to color
   */
  static color(textColor: keyof typeof ColorUtil.COLORS, styles: (keyof typeof ColorUtil.STYLES)[], value: Prim): string {
    if (value === undefined || value === null) {
      return '';
    }
    if (this.colorize) {
      for (const style of [this.COLORS[textColor], ...styles.map(s => this.STYLES[s])]) {
        value = `\x1b[${style[0]}m${value}\x1b[${style[1]}m`;
      }
    }
    return `${value}`;
  }

  /**
   * Produce a factory to color text with a specific style
   *
   * @param textColor Text color
   * @param styles Text styles to apply
   */
  static makeColorer(textColor: keyof typeof ColorUtil.COLORS, ...styles: (keyof typeof ColorUtil.STYLES)[]): (text: Prim) => string {
    return this.color.bind(this, textColor, styles);
  }

  /**
   * Creates a string interpolator for a given palette
   *
   * @param palette The list of supported keys for the string template
   */
  static makeTemplate<T extends Record<string, (text: Prim) => ReturnType<(typeof ColorUtil)['color']>>>(palette: T): TemplateType<T> {
    /**
     * @example
     * ```
     * color`${{title: 'Main Title'}} is ${{subtitle: 'Sub Title}}`
     * ```
     */
    return (values: TemplateStringsArray, ...keys: (Partial<Record<keyof T, Prim>> | string)[]) => {
      if (keys.length === 0) {
        return values[0];
      } else {
        const out = keys.map((el, i) => {
          if (typeof el !== 'string') {
            const subKeys: (keyof T)[] = Object.keys(el);
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