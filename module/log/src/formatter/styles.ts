import * as esp from 'error-stack-parser';

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

export function beautifyError(err: Error) {
  const body = esp.parse(err)
    .filter(x => !/@travetto\/(test|base|compile|registry|exec)/.test(x.fileName!)) // Exclude framework boilerplate
    .reduce(
      (acc, x) => {
        x.fileName = x.fileName!.replace(`${process.cwd()}/`, '').replace('node_modules', 'n_m');
        x.fileName = x.fileName.replace(/n_m\/@travetto\/([^/]+)\/src/g, (a, p) => `@trv/${p}`)
        if (!acc.length || acc[acc.length - 1].fileName !== x.fileName) {
          acc.push(x);
        }
        return acc;
      }, [] as esp.StackFrame[])
    .map(x => {
      const functionName = x.getFunctionName() || '(anonymous)';
      const args = `(${(x.getArgs() || []).join(', ')})`;
      const fileName = x.getFileName() ? (`at ${x.getFileName()}`) : '';
      const lineNumber = x.getLineNumber() !== undefined ? (`:${x.getLineNumber()}`) : '';
      return `\t${functionName + args} ${fileName + lineNumber} `;
    })
    .join('  \n');
}
