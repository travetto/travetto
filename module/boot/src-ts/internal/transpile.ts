import { PathUtil } from '../path';
import { EnvUtil } from '../env';

import { TranspileUtil } from './transpile-util';
import { Module } from './types';
import { TranspileCache } from './transpile-cache';
import { SimpleEntry, SourceIndex } from './source';
import { Host } from '../host';

type UnloadHandler = (file: string, unlink?: boolean) => void;
type LoadHandler<T = unknown> = (name: string, o: T) => T;

/**
 * Utilities for registering the bootstrap process. Hooks into module loading/compiling
 */
export class TranspileManager {
  private static transpile: (filename: string) => string;

  static #moduleResolveFilename = Module._resolveFilename.bind(Module);
  static #moduleLoad = Module._load.bind(Module);
  static #resolveFilename?: (filename: string) => string;
  static #initialized = false;
  static #unloadHandlers: UnloadHandler[] = [];
  static #loadHandlers: LoadHandler[] = [];

  /**
   * Check for module cycles
   */
  static #checkForCycles(mod: unknown, request: string, parent: NodeJS.Module): void {
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
   * Process error response
   * @param phase The load/compile phase to care about
   * @param tsf The typescript filename
   * @param err The error produced
   * @param filename The relative filename
   */
  static #handlePhaseError(phase: 'load' | 'compile', tsf: string, err: Error, filename = tsf.replace(PathUtil.cwd, '.')): string {
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
   * When a module load is requested
   * @param request path to file
   * @param parent parent Module
   */
  static #onModuleLoad(request: string, parent: NodeJS.Module): unknown {
    let mod: unknown;
    try {
      mod = this.#moduleLoad.apply(null, [request, parent]);
      this.#checkForCycles(mod, request, parent);
    } catch (err: unknown) {
      if (!(err instanceof Error)) {
        throw err;
      }
      const name = Module._resolveFilename!(request, parent);
      mod = Module._compile!(this.#handlePhaseError('load', name, err), name);
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
  static setFilenameResolver(fn: (filename: string) => string): void {
    this.#resolveFilename = fn;
  }

  /**
   * Listen for when files are unloaded
   * @param handler
   */
  static onUnload(handler: UnloadHandler): void {
    this.#unloadHandlers.push(handler);
  }

  /**
   * Add module post processor (post-load)
   *
   * @param handler The code to run on post module load
   */
  static onLoad(handler: LoadHandler): void {
    this.#loadHandlers.push(handler);
  }

  /**
   * Clear all unload handlers
   * @private
   */
  static clearHandlers(): void {
    this.#loadHandlers = [];
    this.#unloadHandlers = [];
  }

  /**
   * Set transpiler triggered on require
   */
  static setTranspiler(fn: (file: string) => string): void {
    this.transpile = fn;
  }

  /**
   * Compile and transpile a source file
   * @param m node module
   * @param sourceFile filename
   */
  static compile(m: NodeJS.Module, sourceFile: string): unknown {
    let content = this.transpile(sourceFile);
    const outputFile = sourceFile.replace(Host.EXT.inputRe, Host.EXT.output);
    try {
      return m._compile(content, outputFile);
    } catch (err: unknown) {
      if (!(err instanceof Error)) {
        throw err;
      }
      content = this.#handlePhaseError('compile', sourceFile, err);
      return m._compile(content, outputFile);
    }
  }

  /**
   * Transpile, and cache
   * @param tsf The typescript file to transpile
   * @param force Force transpilation, even if cached
   */
  static simpleTranspile(tsf: string, force = false): string {
    return TranspileCache.getOrSet(tsf, () => TranspileUtil.simpleTranspile(tsf), force);
  }

  /**
   * Enable compile support
   */
  static init(): void {
    if (this.#initialized) {
      return;
    }

    this.setTranspiler(f => this.simpleTranspile(f));

    TranspileCache.init(true);

    // Supports bootstrapping with framework resolution
    if (this.#resolveFilename) {
      Module._resolveFilename = (req, p): string => this.#moduleResolveFilename(this.#resolveFilename!(req), p);
    }
    Module._load = (req, p): unknown => this.#onModuleLoad(req, p);
    require.extensions[Host.EXT.input] = this.compile.bind(this);

    this.#initialized = true;
  }

  /**
   * Transpile all found
   * @param entries
   */
  static transpileAll(entries: SimpleEntry[]): void {
    // Ensure we transpile all files
    for (const { file } of entries) {
      if (!TranspileCache.hasEntry(file)) {
        this.transpile(file);
      }
    }
  }

  /**
   * Remove file from require.cache, and possible the file system
   */
  static unload(filename: string, unlink = false): true | undefined {
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
  static reset(): void {
    if (!this.#initialized || EnvUtil.isCompiled()) {
      return;
    }

    delete require.extensions[Host.EXT.input];
    this.#initialized = false;
    Module._load = this.#moduleLoad;
    if (this.#resolveFilename) {
      Module._resolveFilename = this.#moduleResolveFilename;
    }

    // Unload all
    for (const { file } of SourceIndex.find({ includeIndex: true })) {
      this.unload(file);
    }
  }
}