import { PathUtil } from '../path';
import { Host } from '../host';
import { EnvUtil } from '../env';

/**
 * Utilities for dealing with source files
 */
export class ModuleUtil {

  static #idCache = new Map<string, string>();
  static #devPath = process.env.TRV_DEV;
  static #dynamicModules: Record<string, string>;

  /**
   * Set Dev path
   *
   * @private
   */
  static setDevPath(pth?: string): void {
    this.#devPath = pth ?? process.env.TRV_DEV;
  }

  /**
   * Normalize file path to act as if not in dev mode
   * @private
   * @param file
   * @returns
   */
  static normalizeFrameworkPath(file: string, prefix = ''): string {
    return this.#devPath ? file.replace(this.#devPath, `${prefix}@travetto`) : file;
  }

  /**
   * Resolve dev path to actual location
   * @private
   * @param file
   * @returns
   */
  static resolveFrameworkPath(file: string): string {
    return this.#devPath ? file.replace(/.*@travetto/, m => this.#devPath || m) : file;
  }

  /**
   * Simplifies path name to remove node_modules construct
   * @param file
   */
  static simplifyPath(file: string, localRoot?: string, removeExt = false): string {
    let out = file.replace(/^.*node_modules\//, '');
    if (localRoot !== undefined) {
      out = out.replace(PathUtil.cwd, localRoot);
    }
    if (removeExt) {
      out = out.replace(Host.EXT.inputOutputRe, '');
    }
    return out;
  }

  /**
   * Convert a file name, to a proper module reference for importing, and comparing
   * @param file
   */
  static normalizePath(file: string): string {
    return this.simplifyPath(this.normalizeFrameworkPath(file), '.', true);
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

  /**
   * Get dynamic modules
   */
  static getDynamicModules(): Record<string, string> {
    if (this.#dynamicModules === undefined) {
      this.#dynamicModules = Object.fromEntries(
        EnvUtil.getEntries('TRV_MODULES')
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, v || this.resolveFrameworkPath(PathUtil.resolveUnix('node_modules', k))])
      );
    }
    return this.#dynamicModules;
  }
}