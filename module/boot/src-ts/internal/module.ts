import type * as tsi from 'typescript';
import * as sourceMapSupport from 'source-map-support';

import { TranspileUtil } from './transpile-util';
import { ModuleUtil, Module } from './module-util';
import { SourceUtil } from './source-util';

import { EnvUtil } from '../env';
import { SimpleEntry, SourceIndex } from './source';
import { AppCache } from '../cache';
import { PathUtil } from '../path';

type UnloadHandler = (file: string, unlink?: boolean) => void;

declare const global: {
  ᚕsrc: (f: string) => string;
};

declare global {
  interface Object {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __proto__: unknown;
  }
}

/**
 * Utilities for registering the bootstrap process. Hooks into module loading/compiling
 */
export class ModuleManager {
  static #objectProto = Object.prototype.__proto__;

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
    if (EnvUtil.isReadonly()) {
      fn = (tsf: string): string => AppCache.readEntry(tsf);
    }
    // @ts-expect-error
    this.transpile = fn;
  }

  /**
   * Compile and Transpile .ts file to javascript
   * @param m node module
   * @param tsf filename
   */
  static compile(m: NodeJS.Module, tsf: string): unknown {
    let content = this.transpile(tsf);
    const jsf = tsf.replace(/[.]ts$/, '.js');
    try {
      return m._compile(content, jsf);
    } catch (err: unknown) {
      if (!(err instanceof Error)) {
        throw err;
      }
      content = ModuleUtil.handlePhaseError('compile', tsf, err);
      return m._compile(content, jsf);
    }
  }

  /**
   * Transpile, and cache
   * @param tsf The typescript file to transpile
   * @param force Force transpilation, even if cached
   */
  static simpleTranspile(tsf: string, force = false): string {
    return AppCache.getOrSet(tsf, () => {
      try {
        const diags: tsi.Diagnostic[] = [];
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const ts = require('typescript') as typeof tsi;
        const ret = ts.transpile(SourceUtil.preProcess(tsf), TranspileUtil.compilerOptions, tsf, diags);
        TranspileUtil.checkTranspileErrors(tsf, diags);
        return ret;
      } catch (err: unknown) {
        if (!(err instanceof Error)) {
          throw err;
        }
        return TranspileUtil.transpileError(tsf, err);
      }
    }, force);
  }

  /**
   * Enable compile support
   */
  static init(): void {
    if (this.#initialized) {
      return;
    }

    if (EnvUtil.isReadonly()) {
      console.debug(new Date().toISOString(), 'Running read-only mode, transpilation is disabled');
    }

    this.setTranspiler(f => this.simpleTranspile(f));

    // Registering unix conversion to use for filenames
    global.ᚕsrc = PathUtil.toUnixTs;
    ModuleUtil.init();
    AppCache.init(true);

    // Register source maps for cached files
    sourceMapSupport.install({
      emptyCacheBetweenOperations: EnvUtil.isDynamic(),
      retrieveFile: p => AppCache.readOptionalEntry(PathUtil.toUnixTs(p))!
    });

    // Supports bootstrapping with framework resolution
    if (this.#resolveFilename) {
      Module._resolveFilename = (req, p): string => this.#moduleResolveFilename(this.#resolveFilename!(req), p);
    }
    Module._load = (req, p): unknown => this.#onModuleLoad(req, p);
    require.extensions[SourceUtil.EXT] = this.compile.bind(this);

    // Remove to prevent __proto__ pollution in JSON
    Object.defineProperty(Object.prototype, '__proto__', { configurable: false, enumerable: false, get: () => this.#objectProto });

    this.#initialized = true;
  }

  /**
   * Transpile all found
   * @param found
   */
  static transpileAll(found: SimpleEntry[]): SimpleEntry[] {
    if (!EnvUtil.isReadonly()) {
      // Ensure we transpile all support files
      for (const el of found) {
        if (!AppCache.hasEntry(el.file)) {
          this.transpile(el.file);
        }
      }
    }

    return found;
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
    if (!this.#initialized) {
      return;
    }

    delete require.extensions[SourceUtil.EXT];
    this.#initialized = false;
    Module._load = this.#moduleLoad;
    if (this.#resolveFilename) {
      Module._resolveFilename = this.#moduleResolveFilename;
    }
    ModuleUtil.reset();
    SourceUtil.reset();

    // Unload all
    for (const { file } of SourceIndex.find({ includeIndex: true })) {
      this.unload(file);
    }
  }
}