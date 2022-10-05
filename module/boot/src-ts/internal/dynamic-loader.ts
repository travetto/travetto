import { PathUtil } from '../path';

import { TranspileManager } from './transpile';
import { TranspileUtil } from './transpile-util';
import { Module } from './types';
import { ModuleIndex } from './module';
import { Host } from '../host';

type UnloadHandler = (file: string, unlink?: boolean) => void;
type LoadHandler<T = unknown> = (name: string, o: T) => T;

/**
 * Dynamic module loader. Hooks into module loading/compiling, and transpiles on demand
 */
export class $DynamicLoader {
  #moduleResolveFilename = Module._resolveFilename.bind(Module);
  #moduleLoad = Module._load.bind(Module);
  #resolveFilename?: (filename: string) => string;
  #initialized = false;
  #unloadHandlers: UnloadHandler[] = [];
  #loadHandlers: LoadHandler[] = [];

  /**
   * Check for module cycles
   */
  #checkForCycles(mod: unknown, request: string, parent: NodeJS.Module): void {
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
      mod = Module._compile!(TranspileUtil.handlePhaseError('load', name, err), name);
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
   * Set filename resolver
   * @private
   */
  setFilenameResolver(fn: (filename: string) => string): void {
    this.#resolveFilename = fn;
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

    TranspileManager.init();

    // Supports bootstrapping with framework resolution
    if (this.#resolveFilename) {
      Module._resolveFilename = (req, p): string => this.#moduleResolveFilename(this.#resolveFilename!(req), p);
    }
    Module._load = (req, p): unknown => this.#onModuleLoad(req, p);

    this.#initialized = true;
  }

  /**
   * Remove file from require.cache, and possible the file system
   */
  unload(filename: string, unlink = false): true | undefined {
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
   * Turn off compile support
   */
  reset(): void {
    if (!this.#initialized) {
      return;
    }

    this.#initialized = false;
    TranspileManager.reset();

    Module._load = this.#moduleLoad;
    if (this.#resolveFilename) {
      Module._resolveFilename = this.#moduleResolveFilename;
    }

    // Unload all
    for (const { file } of ModuleIndex.find({ includeIndex: true })) {
      this.unload(file);
    }
  }
}

export const DynamicLoader = new $DynamicLoader();