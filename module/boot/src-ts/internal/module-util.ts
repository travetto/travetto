import * as Mod from 'module';

import { EnvUtil } from '../env';
import { PathUtil } from '../path';
import { Host } from '../host';
import { TranspileUtil } from './transpile-util';

type ModuleHandler<T = unknown> = (name: string, o: T) => T;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    // eslint-disable-next-line no-shadow
    interface Module {
      _load(req: string, parent: Module): unknown;
      _resolveFilename(req: string, parent: Module): string;
      _compile(contents: string, file: string): unknown;
    }
  }
  interface NodeModule {
    _load(req: string, parent: NodeModule): unknown;
    _resolveFilename(req: string, parent: NodeModule): string;
    _compile(contents: string, file: string): unknown;
  }
}


// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export const Module: NodeModule = Mod as unknown as NodeModule;

/**
 * Module utils
 */
export class ModuleUtil {

  static #modCache = new Map<string, string>();

  static #handlers: ModuleHandler[] = [];

  /**
   * Process error response
   * @param phase The load/compile phase to care about
   * @param tsf The typescript filename
   * @param err The error produced
   * @param filename The relative filename
   */
  static handlePhaseError(phase: 'load' | 'compile', tsf: string, err: Error, filename = tsf.replace(PathUtil.cwd, '.')): string {
    if (phase === 'compile' &&
      (err.message.startsWith('Cannot find module') || err.message.startsWith('Unable to load'))
    ) {
      err = new Error(`${err.message} ${err.message.includes('from') ? `[via ${filename}]` : `from ${filename}`}`);
    }

    if (EnvUtil.isDynamic() && !filename.startsWith('test/')) {
      console.trace(`Unable to ${phase} ${filename}: stubbing out with error proxy.`, err.message);
      return TranspileUtil.getErrorModule(err.message);
    }

    throw err;
  }

  /**
   * Add module post processor (post-load)
   *
   * @param handler The code to run on post module load
   */
  static addHandler(handler: ModuleHandler): void {
    this.#handlers.push(handler);
  }

  /**
   * Check for module cycles
   */
  static checkForCycles(mod: unknown, request: string, parent: NodeJS.Module): void {
    if (parent && !parent.loaded) { // Standard ts compiler output
      const desc = mod ? Object.getOwnPropertyDescriptors(mod) : {};
      if (!mod || !('ᚕtrv' in desc) || 'ᚕtrvError' in desc) {
        try {
          const p = Module._resolveFilename!(request, parent);
          if (p && p.endsWith(Host.EXT.input)) {
            throw new Error(`Unable to load ${p}, most likely a cyclical dependency`);
          }
        } catch {
          // Ignore if we can't resolve
        }
      }
    }
  }

  /**
   * Handle module post processing
   */
  static handleModule<T = unknown>(mod: T, request: string, parent: NodeJS.Module): T {
    if (this.#handlers) {
      const name = Module._resolveFilename!(request, parent);
      for (const handler of this.#handlers) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        mod = handler(name, mod) as T;
      }
    }
    return mod;
  }

  /**
   * Convert a file name, to a proper module reference for importing, and comparing
   * @param file
   */
  static normalizePath(file: string): string {
    return PathUtil.simplifyPath(PathUtil.normalizeFrameworkPath(file), '.', true);
  }

  /**
   * Compute internal module id from file name and optionally, class name
   */
  static getId(filename: string, clsName?: string): string {
    filename = PathUtil.resolveUnix(filename);

    if (clsName) {
      return `${this.getId(filename)}￮${clsName}`;
    }

    if (this.#modCache.has(filename)) {
      return this.#modCache.get(filename)!;
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
    this.#modCache.set(filename, name);
    return name;
  }

  /**
   * Clear out on cleanup
   */
  static reset(): void {
    this.#modCache.clear();
    this.#handlers = [];
  }
}