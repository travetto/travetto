// @ts-expect-error
import * as Mod from 'module';

import { EnvUtil } from '../env';
import { PathUtil } from '../path';
import { SourceUtil } from './source-util';

type ModuleHandler<T = unknown> = (name: string, o: T) => T;

export type ModType = {
  loaded?: boolean;
  _load?(req: string, parent: ModType): unknown;
  _resolveFilename?(req: string, parent: ModType): string;
  _compile?(contents: string, file: string): unknown;
} & NodeJS.Module;

const Module = Mod as unknown as ModType;

/**
 * Module utils
 */
export class ModuleUtil {

  private static modCache = new Map<string, string>();

  private static handlers: ModuleHandler[] = [];

  /**
   * Process error response
   * @param phase The load/compile phase to care about
   * @param tsf The typescript filename
   * @param err The error produced
   * @param filename The relative filename
   */
  static handlePhaseError(phase: 'load' | 'compile', tsf: string, err: Error, filename = tsf.replace(PathUtil.cwd, '.')) {
    if (phase === 'compile' &&
      (err.message.startsWith('Cannot find module') || err.message.startsWith('Unable to load'))
    ) {
      err = new Error(`${err.message} ${err.message.includes('from') ? `[via ${filename}]` : `from ${filename}`}`);
    }

    if (EnvUtil.isWatch() && !filename.startsWith('test/')) {
      console.trace(`Unable to ${phase} ${filename}: stubbing out with error proxy.`, err.message);
      return SourceUtil.getErrorModule(err.message);
    }

    throw err;
  }

  /**
   * Add module post processor (post-load)
   *
   * @param handler The code to run on post module load
   */
  static addHandler(handler: ModuleHandler) {
    this.handlers.push(handler);
  }

  /**
   * Check for module cycles
   */
  static checkForCycles(mod: unknown, request: string, parent: ModType) {
    if (parent && !parent.loaded) { // Standard ts compiler output
      const desc = mod ? Object.getOwnPropertyDescriptors(mod) : {};
      if (!mod || !('ᚕtrv' in desc) || 'ᚕtrvError' in desc) {
        try {
          const p = Module._resolveFilename!(request, parent);
          if (p && p.endsWith(SourceUtil.EXT)) {
            throw new Error(`Unable to load ${p}, most likely a cyclical dependency`);
          }
        } catch (err) {
          // Ignore if we can't resolve
        }
      }
    }
  }

  /**
   * Handle module post processing
   */
  static handleModule(mod: unknown, request: string, parent: ModType) {
    if (this.handlers) {
      const name = Module._resolveFilename!(request, parent);
      for (const handler of this.handlers) {
        mod = handler(name, mod);
      }
    }
    return mod;
  }

  /**
   * Initialize module support
   */
  static init() {
    // Tag output to indicate it was succefully processed by the framework
    SourceUtil.addPreProcessor((__, contents) =>
      `${contents}\nObject.defineProperty(exports, 'ᚕtrv', { configurable: true, value: true });`);
  }

  /**
   * Convert a file name, to a proper module reference for importing, and comparing
   * @param file
   */
  static normalizePath(file: string): string {
    return PathUtil.normalizeFrameworkPath(file)
      .replace(/[.][tj]s$/, '')
      .replace(PathUtil.cwd, '.')
      .replace(/^.*node_modules\//, '');
  }

  /**
   * Compute internal module id from file name and optionally, class name
   */
  static getId(filename: string, clsName?: string): string {
    filename = PathUtil.resolveUnix(filename);

    if (clsName) {
      return `${this.getId(filename)}￮${clsName}`;
    }

    if (this.modCache.has(filename)) {
      return this.modCache.get(filename)!;
    }

    let mod = this.normalizePath(filename);

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
    this.modCache.set(filename, name);
    return name;
  }

  /**
   * Clear out on cleanup
   */
  static reset() {
    this.modCache.clear();
    this.handlers = [];
  }
}