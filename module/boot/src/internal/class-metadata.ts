import { PathUtil } from '../path';
import type { Class } from '../types';

/**
 * Register a class as pending
 */
export class ClassMetadataUtil {
  static #idCache = new Map<string, string>();

  /**
   * Compute internal id from file name and optionally, class name
   */
  static computeId(filename: string, clsName?: string): string {
    filename = PathUtil.resolveUnix(filename);

    if (clsName) {
      return `${this.computeId(filename)}￮${clsName}`;
    }

    if (this.#idCache.has(filename)) {
      return this.#idCache.get(filename)!;
    }

    let mod = filename
      .replace(/^.*node_modules\//, '')
      .replace(PathUtil.cwd, '.')
      .replace(/[.]js$/, '');

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
    this.#idCache.set(filename, name);
    return name;
  }

  /**
   * Initialize the meta data for a function
   * @param function Function
   * @param `ᚕfile` Filename
   */
  static initFunctionMeta(fn: Function, ᚕfile: string): boolean {
    fn.ᚕfile = ᚕfile;
    return true;
  }

  /**
   * Initialize the meta data for the cls
   * @param cls Class
   * @param `ᚕfile` Filename
   * @param `ᚕhash` Hash of class contents
   * @param `ᚕmethods` Methods and their hashes
   * @param `ᚕabstract` Is the class abstract
   */
  static initMeta(cls: Class, ᚕfile: string, ᚕhash?: number, ᚕmethods?: Record<string, { hash: number }>, ᚕabstract?: boolean, ᚕsynthetic?: boolean): boolean {
    const meta = {
      ᚕid: this.computeId(ᚕfile, cls.name),
      ᚕfile,
      ᚕhash,
      ᚕmethods,
      ᚕabstract,
      ᚕsynthetic,
    };

    const keys = [...Object.keys(meta)];
    Object.defineProperties(cls, keys.reduce<Partial<Record<keyof typeof meta, PropertyDescriptor>>>((all, k) => {
      all[k] = {
        value: meta[k],
        enumerable: false,
        configurable: false,
        writable: false
      };
      return all;
    }, {}));

    return true;
  }
}