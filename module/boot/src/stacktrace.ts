import { path } from './path';

/**
 * General tools for manipulating stack traces.
 */
export class $StacktraceManager {

  #filters: string[] = [];
  #filterRegex: RegExp = /./g;

  constructor() {
    const names: string[] = [
      '@travetto/(?:watch|context)',
      'src/stacktrace',
      'internal',
      '(?:Array.*?<anonymous>)',
      'async_hooks',
      '[(]native[)]',
      'typescript',
      'tslib',
      'source-map-support'
    ];
    this.#filters.push(...names);
    this.#filterRegex = new RegExp(`(${this.#filters.join('|')})`);
  }

  /**
   * Clean up the stack output for an error
   * @param err The error to filter
   * @param filter Should the stack be filtered
   */
  simplifyStack(err: Error | string, filter = true): string {
    let lastLocation: string = '';
    const cwd = path.cwd();
    const cwdPrefix = `${cwd}/`;
    const body = path.toPosix(typeof err === 'string' ? err : err.stack!)
      .split('\n')
      .filter(x => !filter || !this.#filters.length || !this.#filterRegex.test(x)) // Exclude framework boilerplate
      .reduce<string[]>((acc, line) => {
        const [, location] = line.split(cwd);

        if (location === lastLocation) {
          // Do nothing
        } else {
          if (location) {
            lastLocation = location;
          }
          acc.push(line);
        }
        return acc;
      }, [])
      .map(x => x
        .replace(cwdPrefix, './')
        .replace(/^[\/]+/, '')
      );

    if (!filter || body.length > 2) {
      return body.join('  \n');
    } else {
      return `${body.length}.${this.simplifyStack(err, false)}`;
    }
  }
}

export const StacktraceManager = new $StacktraceManager();

ᚕtrv.resolveStack = function (err: Error): string {
  const stack = StacktraceManager.simplifyStack(err);
  return stack.substring(stack.indexOf('\n') + 1);
};