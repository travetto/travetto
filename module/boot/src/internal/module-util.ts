import { PathUtil } from '../path';

/**
 * Utilities for dealing with source files
 */
export class ModuleUtil {

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
   * Convert an output file to a unix source file
   * @param file .ts or .js file to convert
   */
  static toUnixSource(file: string): string {
    return file.replaceAll('\\', '/').replace(/[.]js$/, '.ts');
  }
}