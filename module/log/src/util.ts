import { FsUtil } from '@travetto/boot';
import { AppManifest } from '@travetto/base';
import { SystemUtil } from '@travetto/base/src/internal/system';

import { LogEvent, Formatter, Appender } from './types';

/**
 * Logging utilities
 */
export class LogUtil {

  /**
   * Produce an event listener
   */
  static buildListener(formatter: Formatter, appender: Appender, filter?: (ev: LogEvent) => boolean) {
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
  static buildFilterPart(p: string) {
    const [, neg, prop] = p.match(/(-|[+])?(.*)/)!;
    const cleaned = (/^.*:[^\/]*[^*]$/.test(prop) ? `${prop}/*` : prop).replace(/([\/.])/g, a => `\\${a}`);
    const key: 'exc' | 'inc' = neg ? 'exc' : 'inc';
    const filter: string[] = [];

    // Auto wildcard for modules
    if (cleaned.startsWith('@app')) {
      const [, sfx] = cleaned.match(/^@app(?::(.*)?)?$/)!;
      for (const el of AppManifest.roots) {
        const sub = SystemUtil.computeModule(FsUtil.resolveUnix(FsUtil.cwd, el, 'src'));
        filter.push(`${sub}${sfx || ''}`);
      }
    } else {
      filter.push(cleaned);
    }

    return { key, filter };
  }

  /**
   * Convert filter into test function for filtering
   */
  static buildFilter(v: string) {
    const config = { inc: [] as string[], exc: [] as string[] };
    const { inc, exc } = config;

    for (const p of v.split(/\s*,\s*/)) {
      const { key, filter } = this.buildFilterPart(p);
      config[key].push(...filter);
    }

    if (inc.includes('*')) {
      inc.splice(0, inc.length);
    } else if (inc.length === 0 && exc.length) { // If excluding and nothing included
      const { key, filter } = this.buildFilterPart('@app');
      config[key].push(...filter); // Listen to src by default if not explicit
    }

    const incRe = new RegExp(`^(${inc.join('|').replace(/[*]/g, '.*')})`);
    const excRe = new RegExp(`^(${exc.join('|').replace(/[*]/g, '.*')})`);

    if (inc.length && exc.length) {
      return (x: string) => incRe.test(x) && !excRe.test(x);
    } else if (inc.length) {
      return (x: string) => incRe.test(x);
    } else if (exc.length) {
      return (x: string) => !excRe.test(x);
    }
  }
}