import * as path from 'path';
import { FsUtil } from '@travetto/boot';

export type Orderable<T> = {
  after?: T[];
  before?: T[];
  key: T;
};

/**
 * Set of internal system utilities
 */
export class SystemUtil {

  private static MOD_CACHE = new Map<string, string>();

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
    U extends Orderable<T>,
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
   * Convert a file name, to a proper module reference for importing, and comparing
   * @param file
   * @param base
   */
  static convertFileToModule(file: string, base?: string): string;
  static convertFileToModule(file: undefined, base?: string): undefined;
  static convertFileToModule(file: string | undefined, base?: string) {
    file = file?.replace(/[.](t|j)s$/, '')
      .replace(process.env.TRV_DEV || '#', '@travetto')
      .replace(FsUtil.cwd, '.')
      .replace(/^.*node_modules\//, '');

    if (
      file?.startsWith('.') &&
      base && (
        !base.startsWith('@travetto') &&
        !base.includes('node_modules')
      )
    ) { // Relative path
      const fileDir = path.dirname(FsUtil.resolveUnix(file));
      const baseDir = path.dirname(FsUtil.resolveUnix(base));
      file = `${path.relative(baseDir, fileDir) || '.'}/${path.basename(file)}`;
      if (/^[A-Za-z]/.test(file)) {
        file = `./${file}`;
      }
    }

    return file;
  }

  /**
   * Compute internal module name from file name
   */
  static computeModule(filename: string) {
    filename = FsUtil.resolveUnix(filename);

    if (this.MOD_CACHE.has(filename)) {
      return this.MOD_CACHE.get(filename)!;
    }

    let mod = this.convertFileToModule(filename);

    let ns: string;

    if (mod.startsWith('@travetto')) {
      const [, ns2, ...rest] = mod.split(/\/+/);
      ns = `@trv:${ns2}`;
      if (rest[0] === 'src') {
        rest.shift();
      }
      mod = rest.join('/');
    } else if (!mod.startsWith('.')) {
      ns = '@npm';
    } else {
      const [ns1, ...rest] = mod.split(/\/+/);
      ns = ns1;
      mod = rest.join('/');
    }

    const name = `${ns}/${mod}`;
    this.MOD_CACHE.set(filename, name);
    return name;
  }

  /**
   * Compute internal class-module name from file name
   */
  static computeModuleClass(filename: string, clsName: string) {
    return `${this.computeModule(filename)}￮${clsName}`;
  }
}