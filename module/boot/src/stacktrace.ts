/**
 * General tools for manipulating stack traces.
 */
export class $StacktraceManager {

  #filters: string[] = [];
  #filterRegex: RegExp = /./g;

  constructor() {
    const names = [
      '@travetto/(?:watch|context)',
      'src/stacktrace',
      'internal',
      '(?:Array.*?<anonymous>)',
      'async_hooks',
      '[(]native[)]',
      'typescript',
      'tslib',
      'source-map-support[.]js'
    ];
    this.#filters.push(...names);
    this.#filterRegex = new RegExp(`(${this.#filters.join('|')})`);
  }

  /**
   * Connect into Error toJSON and set stacktrace limit
   */
  register(): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const mgr = this;

    // TODO: Revisit
    Error.prototype.resolveStack = function (this: Error): string {
      const stack = mgr.simplifyStack(this);
      return stack.substring(stack.indexOf('\n') + 1);
    };
    Error.stackTraceLimit = 50;
  }

  /**
   * Clean up the stack output for an error
   * @param err The error to filter
   * @param filter Should the stack be filtered
   */
  simplifyStack(err: Error | string, filter = true): string {
    let lastLocation: string = '';
    const body = (typeof err === 'string' ? err : err.stack!).replace(/\\/g, '/').split('\n')
      .filter(x => !filter || !this.#filters.length || !this.#filterRegex.test(x)) // Exclude framework boilerplate
      .reduce<string[]>((acc, line) => {
        const [, location] = line.split(process.cwd().__posix);

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
        .replace(`${process.cwd().__posix}/`, './')
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