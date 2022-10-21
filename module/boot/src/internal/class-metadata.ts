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

  static #writeMeta(fn: Function, cfg: Record<string, unknown>): boolean {
    for (const [key, value] of Object.entries(cfg)) {
      Object.defineProperty(fn, `ᚕ${key}`, {
        value,
        enumerable: false,
        configurable: false,
        writable: false
      });
    }
    return true;
  }

  /**
   * Initialize the meta data for a function
   * @param function Function
   * @param `file` Filename
   */
  static initFunctionMeta(fn: Function, file: string): boolean {
    return this.#writeMeta(fn, { file });
  }

  /**
   * Initialize the meta data for the cls
   * @param cls Class
   * @param `file` Filename
   * @param `hash` Hash of class contents
   * @param `methods` Methods and their hashes
   * @param `abstract` Is the class abstract
   */
  static initMeta(cls: Class, file: string, hash: number, methods: Record<string, { hash: number }>, abstract: boolean, synthetic: boolean): boolean {
    const id = this.computeId(file);
    const meta = { id, file, hash, methods, abstract, synthetic };
    return this.#writeMeta(cls, { file, id, meta });
  }
}