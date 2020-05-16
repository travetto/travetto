import { FsUtil } from '@travetto/boot';

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
  static initHandler() {
    this.addStackFilters(
      __filename.replace(/\.js$/, ''),
      // 'timers.js',
      'typescript.js',
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
   */
  static simplifyStack(err: Error, filter = true): string {
    const getLocation = (x: string) => {
      const [, l] = x.split(FsUtil.cwd);
      return l;
    };

    let lastLocation: string = '';
    const body = err.stack!.replace(/\\/g, '/').split('\n')
      .filter(x => !this.filterRegex.test(x)) // Exclude framework boilerplate
      .reduce((acc, line) => {
        const location = getLocation(line);

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
      return this.simplifyStack(err, false);
    }
  }
}