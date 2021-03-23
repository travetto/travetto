import { PathUtil } from '@travetto/boot';
import { AppManifest } from './manifest';

/**
 * General tools for manipulating stack traces.
 */
export class StacktraceUtil {

  private static FILTERS: string[] = [];

  private static FILTER_REGEX: RegExp = /./g;

  /**
   * Initialize
   */
  static init() {
    this.addStackFilters(
      '@travetto/(?:watch|context)',
      'src/stracktrace',
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
  static addStackFilters(...names: string[]) {
    if (this.FILTERS) {
      this.FILTERS.push(...names);
      this.FILTER_REGEX = new RegExp(`(${this.FILTERS.join('|')})`);
    }
  }

  /**
   * Unset all filters
   */
  static clearStackFilters() {
    this.FILTERS = [];
    this.FILTER_REGEX = /##/;
  }

  /**
   * Clean up the stack output for an error
   * @param err The error to filter
   * @param filter Should the stack be filtered
   */
  static simplifyStack(err: Error | string, filter = true): string {
    let lastLocation: string = '';
    const body = (typeof err === 'string' ? err : err.stack!).replace(/\\/g, '/').split('\n')
      .filter(x => !filter || !this.FILTERS.length || !this.FILTER_REGEX.test(x)) // Exclude framework boilerplate
      .reduce((acc, line) => {
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
      }, [] as string[])
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