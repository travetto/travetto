import { EnvUtil } from '@travetto/boot';
import { LogEvent, Formatter, Appender } from './types';

/**
 * Logging utilities
 */
export class LogUtil {

  static truth = () => true;
  static falsehood = () => false;

  /**
   * Produce an event listener
   */
  static buildListener(formatter: Formatter, appender: Appender, filter?: (ev: LogEvent) => boolean) {
    if (filter) {
      return (ev: LogEvent) => {
        if (filter(ev)) {
          appender.append(formatter.format(ev));
        }
      };
    } else {
      return (ev: LogEvent) => appender.append(formatter.format(ev));
    }
  }

  /**
   * Read environment variable to determine filter
   */
  static readEnvVal(key: string, def: string = '') {
    if (EnvUtil.isFalse(key)) {
      return;
    }
    if (EnvUtil.isTrue(key)) {
      return '*';
    }

    let val = EnvUtil.get(key, def);
    if (/,(@trv:)?[*],/.test(`,${val},`)) {
      if (!val.includes(',-')) {
        return '*';
      } else {
        val = val.replace('@trv:*', '*');
      }
    }
    return val;
  }

  /**
   * Convert filter into test function for filtering
   */
  static buildFilter(v: string | undefined) {
    if (!v) {
      return this.falsehood;
    }
    if (v === '*') {
      return this.truth;
    }

    const parts = v.split(',');
    const [inc, exc] = parts.reduce(([i, e], p) => {
      p = p.trim().replace(/[.]/g, '\\.');

      // Auto wildcard for modules
      if (p.includes('@') && !p.includes('/') && !p.endsWith('*')) { // TODO: Handle basic src/test folders now vs @app
        p = `${p}/*`;
      }

      if (p.startsWith('-')) {
        e.push(p.substring(1));
      } else if (!i.length || i[0] !== '*') {
        if (p === '*') {
          i = ['*'];
        } else {
          i.push(p);
        }
      }
      return [i, e];
    }, [[], []] as string[][]);

    if (inc[0] === '*') {
      inc.shift(); // Empty list
    }

    const incRe = new RegExp(`^(${inc.join('|').replace(/[*]/g, '.*')})$`);
    const excRe = new RegExp(`^(${exc.join('|').replace(/[*]/g, '.*')})$`);

    if (inc.length && exc.length) {
      return (x: string) => incRe.test(x) && !excRe.test(x);
    } else if (inc.length) {
      return incRe.test.bind(incRe);
    } else if (exc.length) {
      return (x: string) => !excRe.test(x);
    } else {
      return this.truth;
    }
  }
}