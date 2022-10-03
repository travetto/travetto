import { PathUtil } from '../path';
import { Host } from '../host';

/**
 * Utilities for dealing with source files
 */
export class ModuleUtil {
  static #idCache = new Map<string, string>();

  /**
   * Convert a file name, to a proper module reference for importing, and comparing
   * @param file
   */
  static normalizePath(file: string): string {
    return PathUtil.simplifyPath(PathUtil.normalizeFrameworkPath(file), '.', true);
  }

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

    let mod = this.normalizePath(filename);

    let ns: string;

    if (mod.startsWith('@travetto')) {
      const [, ns2, ...rest] = mod.split(/\/+/);
      ns = `@trv:${ns2}`;
      if (rest[0] === Host.PATH.src) {
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
}