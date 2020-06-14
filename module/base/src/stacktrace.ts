import { FsUtil, EnvUtil } from '@travetto/boot';
import { FrameworkUtil } from '@travetto/boot/src/framework';

/**
 * General tools for manipulating stack traces.
 *
 * The stacktrace handler will not override the global behavior,
 * but relies on the `.toConsole` method for processing the stacktrace
 * before providing it to the console.
 */
export class StacktraceUtil {

  private static filters: string[] = [];

  private static filterRegex: RegExp = /./g;

  /**
   * Initialize
   */
  static init() {
    if (EnvUtil.isProd()) {
      return;
    } else if (FrameworkUtil.devMode) {
      Error.stackTraceLimit = 50; // Set stacktrace to high for local dev
    } else {
      this.addStackFilters('typescript');
    }

    this.addStackFilters(
      __filename.replace(/\.js$/, ''),
      // 'timers.js',
      'async_hooks',
      '(native)',
      'internal',
      'tslib',
      // '<anonymous>',
      'source-map-support.js'
    );
  }

  /**
   * Add a filter to hide certain stack frames
   * @param names List files to exclude from the stack traces
   */
  static addStackFilters(...names: string[]) {
    if (this.filters) {
      this.filters.push(...names);
      this.filterRegex = new RegExp(`(${this.filters.map(x => x.replace(/[().\[\]|?]/g, z => `\\${z}`)).join('|')})`);
    }
  }

  /**
   * Unset all filters
   */
  static clearStackFilters() {
    this.filters = [];
    this.filterRegex = /##/;
  }

  /**
   * Clean up the stack output for an error
   * @param err The error to filter
   * @param filter Should the stack be filtered
   */
  static simplifyStack(err: Error, filter = true): string {
    let lastLocation: string = '';
    const body = err.stack!.replace(/\\/g, '/').split('\n')
      .filter(x => !filter || !this.filters.length || !this.filterRegex.test(x)) // Exclude framework boilerplate
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
        .replace(`${FsUtil.cwd}/`, '')
        .replace(/^[\/]+/, '')
      );

    if (!filter || body.length > 2) {
      return body.join('  \n');
    } else {
      return `${body.length}.${this.simplifyStack(err, false)}`;
    }
  }
}