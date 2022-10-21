import { PathUtil } from '../path';

import { Module } from './types';
import { ModuleIndex } from './module';
import { EnvUtil } from '../env';

type UnloadHandler = (file: string, unlink?: boolean) => void;
type LoadHandler<T = unknown> = (name: string, o: T) => T;

/**
 * Dynamic module loader. Hooks into module loading
 */
export class $DynamicLoader {

  /**
   * Build error module source
   * @param message Error message to show
   * @param isModule Is the error a module that should have been loaded
   * @param base The base set of properties to support
   */
  static getErrorModuleSource(message: string, isModule?: string | boolean, base?: Record<string, string | boolean>): string {
    const f = ([k, v]: string[]): string => `${k}: (t,k) => ${v}`;
    const e = '{ throw new Error(msg); }';
    const map: { [P in keyof ProxyHandler<object>]?: string } = {
      getOwnPropertyDescriptor: base ? '({})' : e,
      get: base ? `{ const v = values[keys.indexOf(k)]; if (!v) ${e} else return v; }` : e,
      has: base ? 'keys.includes(k)' : e
    };
    return [
      (typeof isModule === 'string') ? `console.debug(\`${isModule}\`);` : '',
      base ? `let keys = ['${Object.keys(base).join("','")}']` : '',
      base ? `let values = ['${Object.values(base).join("','")}']` : '',
      `let msg = \`${message}\`;`,
      "Object.defineProperty(exports, 'ⲐtrvError', { value: true })",
      `module.exports = new Proxy({}, { ${Object.entries(map).map(([k, v]) => f([k, v!])).join(',')}});`
    ].join('\n');
  }

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
      return this.getErrorModuleSource(err.message);
    }

    throw err;
  }

  #moduleLoad = Module._load.bind(Module);
  #initialized = false;
  #unloadHandlers: UnloadHandler[] = [];
  #loadHandlers: LoadHandler[] = [];

  /**
   * Check for module cycles
   */
  #checkForCycles(mod: unknown, request: string, parent: NodeJS.Module): void {
    if (parent && !parent.loaded) { // Standard ts compiler output
      const desc = mod ? Object.getOwnPropertyDescriptors(mod) : {};
      if (!mod || !('Ⲑtrv' in desc) || 'ⲐtrvError' in desc) {
        try {
          const p = Module._resolveFilename!(request, parent);
          if (p && !p.includes('node_modules')) {
            throw new Error(`Unable to load ${p}, most likely a cyclical dependency`);
          }
        } catch {
          // Ignore if we can't resolve
        }
      }
    }
  }

  /**
   * When a module load is requested
   * @param request path to file
   * @param parent parent Module
   */
  #onModuleLoad(request: string, parent: NodeJS.Module): unknown {
    let mod: unknown;
    try {
      mod = this.#moduleLoad.apply(null, [request, parent]);
      this.#checkForCycles(mod, request, parent);
    } catch (err: unknown) {
      if (!(err instanceof Error)) {
        throw err;
      }
      const name = Module._resolveFilename!(request, parent);
      mod = Module._compile!($DynamicLoader.handlePhaseError('load', name, err), name);
    }

    if (this.#loadHandlers.length) {
      const name = Module._resolveFilename!(request, parent);
      for (const handler of this.#loadHandlers) {
        mod = handler(name, mod);
      }
    }

    return mod;
  }

  /**
   * Listen for when files are unloaded
   * @param handler
   */
  onUnload(handler: UnloadHandler): void {
    this.#unloadHandlers.push(handler);
  }

  /**
   * Add module post processor (post-load)
   *
   * @param handler The code to run on post module load
   */
  onLoad(handler: LoadHandler): void {
    this.#loadHandlers.push(handler);
  }

  /**
   * Clear all unload handlers
   * @private
   */
  clearHandlers(): void {
    this.#loadHandlers = [];
    this.#unloadHandlers = [];
  }

  /**
   * Enable compile support
   */
  init(): void {
    if (this.#initialized) {
      return;
    }

    Module._load = (req, p): unknown => this.#onModuleLoad(req, p);

    this.#initialized = true;
  }

  /**
   * Remove file from require.cache, and possible the file system
   */
  async unload(filename: string, unlink = false): Promise<true | undefined> {
    const native = PathUtil.toNative(filename);
    for (const el of this.#unloadHandlers) {
      el(filename, unlink);
    }
    if (native in require.cache) {
      delete require.cache[native]; // Remove require cached element
      return true;
    }
  }

  /**
   * Load a file
   */
  async load(filename: string): Promise<void> {
    require(filename);
  }

  /**
   * Reload a file
   * @param filename
   */
  async reload(filename: string): Promise<void> {
    await this.unload(filename);
    await this.load(filename);
  }

  /**
   * Turn off compile support
   */
  reset(): void {
    if (!this.#initialized) {
      return;
    }

    this.#initialized = false;

    Module._load = this.#moduleLoad;

    // Unload all
    for (const { file } of ModuleIndex.findSrc({})) {
      this.unload(file);
    }
  }
}

export const DynamicLoader = new $DynamicLoader();