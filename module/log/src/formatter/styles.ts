export const STYLES: { [key: string]: [number, number] } = {
  // styles
  bold: [1, 22],
  italic: [3, 23],
  underline: [4, 24],
  inverse: [7, 27],
  // grayscale
  white: [37, 39],
  grey: [90, 39],
  black: [90, 39],
  // colors
  blue: [34, 39],
  cyan: [36, 39],
  green: [32, 39],
  magenta: [35, 39],
  red: [31, 39],
  yellow: [33, 39]
};

export const LEVEL_STYLES: { [key: string]: string[] } = {
  info: ['white'],
  error: ['red'],
  debug: ['grey'],
  warn: ['magenta'],
  fatal: ['cyan', 'inverse'],
  trace: ['yellow']
};

/**
 * Taken from masylum's fork (https://github.com/masylum/log4js-node)
 */
export function stylize(text: string, ...styles: string[]) {
  for (const style of styles) {
    const res = STYLES[style];
    if (res) {
      text = `\x1B[${res[0]}m${text}\x1B[${res[1]}m`;
    }
  }
  return text;
}

export function makeLink(text: string, link: string) {
  return `${link}`;
}