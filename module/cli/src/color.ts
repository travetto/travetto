import { EnvUtil } from '@travetto/boot';

const COLORS = {
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

function colorizeAny(col: keyof typeof COLORS, value: string | number | boolean): string;
function colorizeAny(col: keyof typeof COLORS, value: any) {
  if (colorize === undefined) {
    // Load on demand, synchronously
    colorize = (process.stdout.isTTY && !EnvUtil.isTrue('NO_COLOR')) || EnvUtil.isTrue('FORCE_COLOR');
  }
  if (colorize && value !== undefined && value !== null && value !== '') {
    const code = COLORS[col];
    value = `${code}${value}${COLORS.reset}`;
  }
  return value;
}

const ColorMapping = {
  input: 'yellow',
  output: 'magenta',
  path: 'white',
  success: 'green',
  failure: 'red',
  param: 'green',
  type: 'blue',
  description: 'gray',
  title: 'white',
  identifier: 'blue',
  subtitle: 'gray'
} as const;

type Color = keyof typeof ColorMapping;

// TODO: Document
export const ColorSupport = (Object.keys(ColorMapping) as Color[]).reduce((acc, k) => {
  acc[k] = v => colorizeAny(ColorMapping[k], v);
  return acc;
}, {} as Record<Color, (inp: any) => string>);

// TODO: Document
export function color(values: TemplateStringsArray, ...keys: (Partial<Record<Color, any>> | string)[]) {
  if (keys.length === 0) {
    return values[0];
  } else {
    const out = keys.map((el, i) => {
      const subKeys = Object.keys(el);
      if (subKeys.length === 1 && subKeys[0] in ColorSupport) {
        const [k] = subKeys as Color[];
        el = ColorSupport[k]((el as any)[k]);
      }
      return `${values[i] ?? ''}${el ?? ''}`;
    });
    if (values.length > keys.length) {
      out.push(values[values.length - 1]);
    }
    return out.join('');
  }
}
