import { NAMED_COLORS } from './named-colors';

type I = number;
export type RGB = [r: I, g: I, b: I] | (readonly [r: I, g: I, b: I]);
export type TermColorLevel = 0 | 1 | 2 | 3;
export type TermColorScheme = 'dark' | 'light';
export type DefinedColor = { rgb: RGB, idx16: I, idx16bg: I, idx256: I, scheme: TermColorScheme };
export type RGBInput = I | keyof (typeof NAMED_COLORS) | `#${string}`;

export type TermStyle =
  { text?: RGBInput, background?: RGBInput, italic?: boolean, underline?: boolean, inverse?: boolean, blink?: boolean };

export type TermStyleInput = TermStyle | RGBInput;
type Prim = string | number | boolean | Date | RegExp;
export type TermColorPaletteInput = Record<string, TermStyleInput | [dark: TermStyleInput, light: TermStyleInput]>;
export type TermColorFn = (text: Prim) => string;
export type TermColorPalette<T> = Record<keyof T, TermColorFn>;
