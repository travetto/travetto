import { FsUtil, EnvUtil } from '@travetto/boot';

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
      __filename.replace(/\.js$/, ''),
      'async_hooks',
      '(native)',
      'internal',
      'tslib',
      '@travetto/boot', // @life-if !$TRV_DEV
      '@travetto/context', // @life-if !$TRV_DEV
      '@travetto/watch', // @life-if !$TRV_DEV
      'typescript',  // @life-if !$TRV_DEV
      'source-map-support.js'
    );

    if (!EnvUtil.isProd()) {
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
      this.FILTER_REGEX = new RegExp(`(${this.FILTERS.map(x => x.replace(/[().\[\]|?]/g, z => `\\${z}`)).join('|')})`);
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
        const [, location] = line.split(FsUtil.cwd);

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
        .replace(`${FsUtil.cwd}/`, './')
        .replace(/^[\/]+/, '')
      );

    if (!filter || body.length > 2) {
      return body.join('  \n');
    } else {
      return `${body.length}.${this.simplifyStack(err, false)}`;
    }
  }
}