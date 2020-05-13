import * as path from 'path';
import { FsUtil } from '@travetto/boot';

/**
 * Set of internal system utilities
 */
export class SystemUtil {

  private static modCache = new Map<string, string>();

  /**
   * Track idle activity with ability to extend
   */
  static idle(timeout: number, onTimeout: () => void) {
    let timer: NodeJS.Timer | undefined;
    /**
     * Stop countdown
     */
    function stop() {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    }

    /**
     * Start countdown
     */
    function start(force = false) {
      if (timer) {
        if (force) {
          stop();
        } else {
          return;
        }
      }
      timer = setTimeout(onTimeout, timeout);
      timer.unref();
    }
    return { start, stop, restart: start.bind(null, true) };
  }

  /**
   * Throttle a function to run only once within a specific threshold of time
   */
  static throttle<T extends any[]>(fn: (...args: T[]) => void, threshold = 250) {
    let last = 0;
    let deferTimer: NodeJS.Timer;
    return function check(...args: any[]) {
      const now = Date.now();
      // Still within throttle window
      if (last && now < last + threshold) {
        clearTimeout(deferTimer);
        deferTimer = setTimeout(check, threshold + 1);
      } else { // Must call
        last = now;
        fn(...args);
      }
    };
  }

  /**
   * A fast and naive hash, used for detecting changes in code
   */
  static naiveHash(text: string) {
    let hash = 5381;

    for (let i = 0; i < text.length; i++) {
      // eslint-disable-next-line no-bitwise
      hash = (hash * 33) ^ text.charCodeAt(i);
    }

    return Math.abs(hash);
  }

  /**
   * Produces a satisfied ordering for a list of orderable elements
   */
  static computeOrdering<T,
    U extends {
      after?: T[];
      before?: T[];
      key: T;
    },
    V extends {
      after: Set<T>;
      key: T;
      target: U;
    }
  >(items: U[]) {

    // Turn items into a map by .key value, pointing to a mapping of type V
    const allMap = new Map(items.map(x => [
      x.key, {
        key: x.key,
        target: x,
        after: new Set(x.after || [])
      }
    ] as [T, V]));

    const all = new Set<V>(allMap.values());

    // Loop through all new items of type V, converting before into after
    for (const item of all) {
      const before = item.target.before || [];
      for (const bf of before) {
        if (allMap.has(bf)) {
          allMap.get(bf)!.after.add(item.key);
        }
      }
      item.after = new Set(Array.from(item.after).filter(x => allMap.has(x)));
    }

    // Loop through all items again
    const out: U[] = [];
    while (all.size > 0) {

      // Find node with no dependencies
      const next = [...all].find(x => x.after.size === 0);
      if (!next) {
        throw new Error(`Unsatisfiable dependency: ${[...all].map(x => x.target)}`);
      }

      // Store, and remove
      out.push(next.target);
      all.delete(next);

      // Remove node from all other elements in `all`
      for (const rem of all) {
        rem.after.delete(next.key);
      }
    }

    return out;
  }

  /**
   * Compute internal module name from file name
   */
  static computeModule(fileName: string) {
    fileName = path.resolve(fileName);

    if (this.modCache.has(fileName)) {
      return this.modCache.get(fileName)!;
    }

    let mod = FsUtil.toUnix(fileName).replace(/\.(t|j)s$/, ''); // Drop ext
    let ns: string;

    if (!mod.includes(FsUtil.cwd)) {
      ns = '@sys';
      mod = mod.replace(/\/+/g, '.');
    } else {
      [, mod] = mod.split(`${FsUtil.cwd}/`);
      if (mod.includes('node_modules')) {
        mod = mod.replace(/.*node_modules(.*node_modules)?\/+/, '');
        if (mod.startsWith('@travetto')) { // If scoped
          const [, ns2, ...rest] = mod.split(/\/+/);
          ns = `@trv:${ns2}`;
          if (rest[0] === 'src') {
            rest.shift();
          }
          mod = rest.join('.');
        } else {
          ns = `@npm`;
        }
      } else {
        const [ns1, ...rest] = mod.split(/\/+/);
        ns = `${ns1}`;
        mod = rest.join('.');
      }
    }

    const name = `${ns}/${mod}`;
    this.modCache.set(fileName, name);
    return name;
  }

  /**
   * Compute internal class-module name from file name
   */
  static computeModuleClass(fileName: string, clsName: string) {
    return `${this.computeModule(fileName)}￮${clsName}`;
  }

  /**
   * Builds a regex to match prefix of any number of paths
   * @param paths
   */
  static pathMatcher(paths: string[]) {
    if (!paths.length) {
      return /^$/;
    } else {
      const finalPaths = paths
        .map(x => x.replace(/^[.]\/?/g, ''))
        .map(x => `${x === '' ? '' : `${x}/`}`);
      return new RegExp(`^(${finalPaths.join('|')})`);
    }
  }
}