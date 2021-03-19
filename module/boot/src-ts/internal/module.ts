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
  private static moduleLoad = Module._load!.bind(Module);
  private static resolveFilename = Module._resolveFilename!.bind(Module);
  // @ts-expect-error
  private static objectProto = Object.prototype.__proto__; // Remove to prevent __proto__ pollution in JSON
  private static initialized = false;
  private static unloadHandlers: UnloadHandler[] = [];

  static readonly transpile: (filename: string) => string;

  /**
   * When a module load is requested
   * @param request path to file
   * @param parent parent Module
   */
  private static onModuleLoad(request: string, parent: ModType): unknown {
    let mod: unknown;
    try {
      mod = this.moduleLoad.apply(null, [request, parent]);
      ModuleUtil.checkForCycles(mod, request, parent);
    } catch (e) {
      const name = Module._resolveFilename!(request, parent);
      mod = Module._compile!(ModuleUtil.handlePhaseError('load', name, e), name);
    }
    return ModuleUtil.handleModule(mod, request, parent);
  }

  /**
   * Listen for when files are unloaded
   * @param handler
   */
  static onUnload(handler: UnloadHandler) {
    this.unloadHandlers.push(handler);
  }

  /**
   * Set transpiler triggered on require
   */
  static setTranspiler(fn: (file: string) => string) {
    if (EnvUtil.isReadonly()) {
      this.setTranspiler((tsf: string) => AppCache.readEntry(tsf));
      console.debug('In readonly mode, refusing to set transpiler');
    } else {
      // @ts-expect-error
      this.transpile = fn;
    }
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
    if (this.initialized) {
      return;
    }

    // Only do for dev
    if (process.env.TRV_DEV) {
      // Override filename resolution
      Module._resolveFilename = (req, p) => this.resolveFilename(ModuleUtil.devResolveFilename(req), p);
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
    Module._load = (req, p) => this.onModuleLoad(req, p);
    require.extensions[SourceUtil.EXT] = this.compile.bind(this);

    Object.defineProperty(Object.prototype, '__proto__', { configurable: false, enumerable: false, get: () => this.objectProto });

    this.initialized = true;
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
    for (const el of this.unloadHandlers) {
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
    if (!this.initialized) {
      return;
    }

    delete require.extensions[SourceUtil.EXT];
    this.initialized = false;
    Module._load = this.moduleLoad;
    Module._resolveFilename = this.resolveFilename;
    ModuleUtil.reset();
    SourceUtil.reset();

    // Unload all
    for (const { file } of SourceIndex.find({ includeIndex: true })) {
      this.unload(file);
    }
  }
}