import { AppCache } from '../cache';
import { PathUtil } from '../path';
import { EnvUtil } from '../env';

import { TranspileUtil } from './transpile-util';
import { ModuleUtil, Module } from './module-util';
import { SimpleEntry, SourceIndex } from './source';
import { Host } from '../host';

type UnloadHandler = (file: string, unlink?: boolean) => void;

/**
 * Utilities for registering the bootstrap process. Hooks into module loading/compiling
 */
export class ModuleManager {
  static #moduleResolveFilename = Module._resolveFilename.bind(Module);
  static #moduleLoad = Module._load.bind(Module);
  static #resolveFilename?: (filename: string) => string;
  static #initialized = false;
  static #unloadHandlers: UnloadHandler[] = [];

  static readonly transpile: (filename: string) => string;

  /**
   * When a module load is requested
   * @param request path to file
   * @param parent parent Module
   */
  static #onModuleLoad(request: string, parent: NodeJS.Module): unknown {
    let mod: unknown;
    try {
      mod = this.#moduleLoad.apply(null, [request, parent]);
      ModuleUtil.checkForCycles(mod, request, parent);
    } catch (err: unknown) {
      if (!(err instanceof Error)) {
        throw err;
      }
      const name = Module._resolveFilename!(request, parent);
      mod = Module._compile!(ModuleUtil.handlePhaseError('load', name, err), name);
    }
    return ModuleUtil.handleModule(mod, request, parent);
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
   * Clear all unload handlers
   * @private
   */
  static clearUnloadHandlers(): void {
    this.#unloadHandlers = [];
  }

  /**
   * Set transpiler triggered on require
   */
  static setTranspiler(fn: (file: string) => string): void {
    // @ts-expect-error
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
      content = ModuleUtil.handlePhaseError('compile', sourceFile, err);
      return m._compile(content, outputFile);
    }
  }

  /**
   * Transpile, and cache
   * @param tsf The typescript file to transpile
   * @param force Force transpilation, even if cached
   */
  static simpleTranspile(tsf: string, force = false): string {
    return AppCache.getOrSet(tsf, () => TranspileUtil.simpleTranspile(tsf), force);
  }

  /**
   * Enable compile support
   */
  static init(): void {
    if (this.#initialized) {
      return;
    }

    this.setTranspiler(f => this.simpleTranspile(f));

    AppCache.init(true);

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
      if (!AppCache.hasEntry(file)) {
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
    ModuleUtil.reset();

    // Unload all
    for (const { file } of SourceIndex.find({ includeIndex: true })) {
      this.unload(file);
    }
  }
}