import { PathUtil } from '@travetto/boot';
import { AppManifest } from './manifest';

/**
 * General tools for manipulating stack traces.
 */
export class $StacktraceManager {

  #filters: string[] = [];
  #filterRegex: RegExp = /./g;

  /**
   * Initialize
   */
  init(): void {
    this.addStackFilters(
      '@travetto/(?:watch|context)',
      'src/stacktrace',
      '(?:boot|base|[.])/bin/(?:main|register)[.]js',
      'internal',
      '(?:Array.*?<anonymous>)',
      'async_hooks',
      '[(]native[)]',
      'typescript',
      'tslib',
      'source-map-support[.]js'
    );

    if (!AppManifest.prod) {
      Error.stackTraceLimit = 50;
    }
  }

  /**
   * Add a filter to hide certain stack frames
   * @param names List files to exclude from the stack traces
   */
  addStackFilters(...names: string[]): void {
    if (this.#filters) {
      this.#filters.push(...names);
      this.#filterRegex = new RegExp(`(${this.#filters.join('|')})`);
    }
  }

  /**
   * Unset all filters
   */
  clearStackFilters(): void {
    this.#filters = [];
    this.#filterRegex = /##/;
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
        const [, location] = line.split(PathUtil.cwd);

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
        .replace(`${PathUtil.cwd}/`, './')
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