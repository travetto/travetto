import { TypedObject } from './types';

import { COLOR_NAMES } from './color-support/names';
import { ColorUtil, ColorLevel, StyleInput, ColorPalette, TemplateType, Prim, ColorFn, NamedColor, NamedColorInput } from './color-support/util';

/**
 * Color support with ability to create templates/palettes with named colors
 */
export class ColorSupport<T extends Record<string, NamedColorInput>> {

  #level: ColorLevel;
  #colors: Record<keyof T, NamedColor>;

  constructor(colors: T, level?: ColorLevel) {
    this.#level = level ?? ColorUtil.detectLevel();

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    this.#colors = TypedObject.fromEntries(
      TypedObject.entries(colors).map(([k, v]) => [k, ColorUtil.makeNamedColor(v)])
    ) as Record<keyof T, NamedColor>;
  }

  /**
   * Get all colors
   */
  getColors(): Record<Exclude<keyof T, number | symbol>, NamedColor> {
    return this.#colors;
  }

  /**
   * Make a simple primitive colorer
   */
  colorer(col: StyleInput<Exclude<keyof T, number | symbol>>): ColorFn {
    const levels = ColorUtil.makeColorer(this.#colors, col);
    return (v: Prim): string => levels[this.#level](v);
  }

  /**
   * Creates a color palette based on input style
   */
  palette<P extends Record<string, StyleInput<Exclude<keyof T, number | symbol>>>>(input: P): ColorPalette<P> {
    // Common color support
    const out: Partial<ColorPalette<P>> = {};
    for (const [k, col] of TypedObject.entries(input)) {
      out[k] = this.colorer(col);
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return out as ColorPalette<P>;
  }

  /**
   * Convenience method to creates a color template function based on input style
   */
  template<P extends Record<string, StyleInput<Exclude<keyof T, number | symbol>>>>(input: P): TemplateType<P> {
    return ColorUtil.makeTemplate(this.palette(input));
  }
}

/**
 * Centralized color state that, by default, all console output is tied to
 */
export const GlobalColorSupport = new ColorSupport(COLOR_NAMES);