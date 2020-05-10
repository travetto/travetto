import { EnvUtil } from '@travetto/boot';

const Codes = {
  blue: `\x1b[94m`,
  yellow: `\x1b[93m`,
  green: `\x1b[92m`,
  gray: `\x1b[37m\x1b[2m`,
  red: `\x1b[31m`,
  cyan: `\x1b[96m`,
  magenta: `\x1b[95m`,
  white: `\x1b[97m\x1b[1m`,
  reset: `\x1b[0m`,
};

let colorize: boolean;

function colorizeAny(col: string, value: string | number | boolean): string;
function colorizeAny(col: string, value: any) {
  if (colorize === undefined) {
    // Load on demand, synchronously
    colorize = EnvUtil.isSetTrueOrFalse('FORCE_COLOR', 'NO_COLOR', process.stdout.isTTY);
  }
  if (colorize && value !== undefined && value !== null && value !== '') {
    value = `${col}${value}${Codes.reset}`;
  }
  return value;
}

function c(key: string) {
  return (v: any) => colorizeAny(key, v);
}

/**
 * Map of common keys to specific colors
 */
export const Colors = {
  input: c(Codes.yellow),
  output: c(Codes.magenta),
  path: c(Codes.white),
  success: c(Codes.green),
  failure: c(Codes.red),
  param: c(Codes.green),
  type: c(Codes.blue),
  description: c(Codes.gray),
  title: c(Codes.white),
  identifier: c(Codes.blue),
  subtitle: c(Codes.gray)
};

type Color = keyof typeof Colors;

/**
 * Colorize a string, as a string interpolation
 *
 * @example
 * ```
 * color`${{title: 'Main Title'}} is ${{subtitle: 'Sub Title}}`
 * ```
 */
export function color(values: TemplateStringsArray, ...keys: (Partial<Record<Color, any>> | string)[]) {
  if (keys.length === 0) {
    return values[0];
  } else {
    const out = keys.map((el, i) => {
      const subKeys = Object.keys(el);
      if (subKeys.length === 1 && subKeys[0] in Colors) {
        const [k] = subKeys as Color[];
        el = Colors[k]((el as any)[k]);
      }
      return `${values[i] ?? ''}${el ?? ''}`;
    });
    if (values.length > keys.length) {
      out.push(values[values.length - 1]);
    }
    return out.join('');
  }
}
