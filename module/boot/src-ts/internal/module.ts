// @ts-ignore
import * as Mod from 'module';
import type * as tsi from 'typescript';
import * as sourceMapSupport from 'source-map-support';

import { TranspileUtil } from './transpile-util';
import { ModuleUtil, ModType } from './module-util';
import { SourceUtil } from './source-util';

import { EnvUtil } from '../env';
import { SimpleEntry, SourceIndex } from './source';
import { AppCache } from '../cache';
import { PathUtil } from '../path';

export const Module = Mod as unknown as ModType;

type UnloadHandler = (file: string, unlink?: boolean) => void;

declare const global: {
  ᚕsrc: (f: string) => string;
};

/**
 * Utilities for registering the bootstrap process. Hooks into module loading/compiling
 */
export class ModuleManager {
  // @ts-expect-error
  static #objectProto = Object.prototype.__proto__; // Remove to prevent __proto__ pollution in JSON

  static #moduleResolveFilename = Module._resolveFilename!.bind(Module);
  static #moduleLoad = Module._load!.bind(Module);
  static #resolveFilename?: (filename: string) => string;
  static #initialized = false;
  static #unloadHandlers: UnloadHandler[] = [];

  static readonly transpile: (filename: string) => string;

  /**
   * When a module load is requested
   * @param request path to file
   * @param parent parent Module
   */
  static #onModuleLoad(request: string, parent: ModType): unknown {
    let mod: unknown;
    try {
      mod = this.#moduleLoad.apply(null, [request, parent]);
      ModuleUtil.checkForCycles(mod, request, parent);
    } catch (e) {
      const name = Module._resolveFilename!(request, parent);
      mod = Module._compile!(ModuleUtil.handlePhaseError('load', name, e), name);
    }
    return ModuleUtil.handleModule(mod, request, parent);
  }

  /**
   * Set filename resolver
   * @private
   */
  static setFilenameResolver(fn: (filename: string) => string) {
    this.#resolveFilename = fn;
  }

  /**
   * Listen for when files are unloaded
   * @param handler
   */
  static onUnload(handler: UnloadHandler) {
    this.#unloadHandlers.push(handler);
  }

  /**
   * Clear all unload handlers
   * @private
   */
  static clearUnloadHandlers() {
    this.#unloadHandlers = [];
  }

  /**
   * Set transpiler triggered on require
   */
  static setTranspiler(fn: (file: string) => string) {
    if (EnvUtil.isReadonly()) {
      fn = (tsf: string) => AppCache.readEntry(tsf);
      console.debug('In readonly mode, refusing to set transpiler');
    }
    // @ts-expect-error
    this.transpile = fn;
  }

  /**
   * Compile and Transpile .ts file to javascript
   * @param m node module
   * @param tsf filename
   */
  static compile(m: ModType, tsf: string) {
    let content = this.transpile(tsf);
    const jsf = tsf.replace(/[.]ts$/, '.js');
    try {
      return m._compile!(content, jsf);
    } catch (e) {
      content = ModuleUtil.handlePhaseError('compile', tsf, e);
      return m._compile!(content, jsf);
    }
  }

  /**
   * Transpile, and cache
   * @param tsf The typescript file to transpile
   * @param force Force transpilation, even if cached
   */
  static simpleTranspile(tsf: string, force = false) {
    return AppCache.getOrSet(tsf, () => {
      try {
        const diags: tsi.Diagnostic[] = [];
        const ts = require('typescript') as typeof tsi;
        const ret = ts.transpile(SourceUtil.preProcess(tsf), TranspileUtil.compilerOptions as tsi.CompilerOptions, tsf, diags);
        TranspileUtil.checkTranspileErrors(tsf, diags);
        return ret;
      } catch (err) {
        return TranspileUtil.transpileError(tsf, err);
      }
    }, force);
  }

  /**
   * Enable compile support
   */
  static init() {
    if (this.#initialized) {
      return;
    }

    this.setTranspiler(f => this.simpleTranspile(f));

    // Registering unix conversion to use for filenames
    global.ᚕsrc = PathUtil.toUnixTs;
    ModuleUtil.init();
    AppCache.init(true);

    // Register source maps for cached files
    sourceMapSupport.install({
      emptyCacheBetweenOperations: EnvUtil.isWatch(),
      retrieveFile: p => AppCache.readOptionalEntry(PathUtil.toUnixTs(p))!
    });

    // Supports bootstrapping with framework resolution
    if (this.#resolveFilename) {
      Module._resolveFilename = (req, p) => this.#moduleResolveFilename(this.#resolveFilename!(req), p);
    }
    Module._load = (req, p) => this.#onModuleLoad(req, p);
    require.extensions[SourceUtil.EXT] = this.compile.bind(this);

    Object.defineProperty(Object.prototype, '__proto__', { configurable: false, enumerable: false, get: () => this.#objectProto });

    this.#initialized = true;
  }

  /**
   * Transpile all found
   * @param found
   */
  static transpileAll(found: SimpleEntry[]) {
    if (EnvUtil.isReadonly()) {
      console.debug('Skipping transpilation as we are in read-only mode');
    } else {
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
  static unload(filename: string, unlink = false) {
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
  static reset() {
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