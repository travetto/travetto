import { LogEvent, Formatter, Appender } from './types';

/**
 * Logging utilities
 */
export class LogUtil {

  /**
   * Produce an event listener
   */
  static buildListener(formatter: Formatter, appender: Appender, filter?: (ev: LogEvent) => boolean): (ev: LogEvent) => void {
    if (filter) {
      return (ev: LogEvent) => {
        if (filter(ev)) {
          appender.append(ev.level, formatter.format(ev));
        }
      };
    } else {
      return (ev: LogEvent) => appender.append(ev.level, formatter.format(ev));
    }
  }

  /**
   * Build a filter element
   */
  static buildModuleFilter(expr: string): { key: 'exc' | 'inc', filter: string[] } {
    const [, neg, mod] = expr.match(/(-|[+])?(.*)/)!;
    const key: 'exc' | 'inc' = neg ? 'exc' : 'inc';
    const filter: string[] = [];

    if (mod === '*') {
      filter.push('*');
    } else {
      // Auto wildcard for modules
      filter.push(`${mod}:.*`);
    }

    return { key, filter };
  }

  /**
   * Convert filter into test function for filtering
   */
  static buildFilter(v: string): ((file: string) => boolean) | undefined {
    const config: { inc: string[], exc: string[] } = { inc: [], exc: [] };
    const { inc, exc } = config;

    for (const mod of v.split(/\s*,\s*/)) {
      const { key, filter } = this.buildModuleFilter(mod);
      config[key].push(...filter);
    }

    if (inc.includes('*')) {
      inc.splice(0, inc.length);
    } else if (inc.length === 0 && exc.length) { // If excluding and nothing included
      const { key, filter } = this.buildModuleFilter('@');
      config[key].push(...filter); // Listen to src by default if not explicit
    }

    const incRe = new RegExp(`^(${inc.join('|')})`);
    const excRe = new RegExp(`^(${exc.join('|')})`);

    if (inc.length && exc.length) {
      return (x: string) => incRe.test(x) && !excRe.test(x);
    } else if (inc.length) {
      return (x: string) => incRe.test(x);
    } else if (exc.length) {
      return (x: string) => !excRe.test(x);
    }
  }
}