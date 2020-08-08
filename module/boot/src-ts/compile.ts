// @ts-ignore
import * as Mod from 'module';

import { TranspileUtil } from './transpile';
import { FrameworkUtil } from './framework';
import { FsUtil } from './fs';

type Module = {
  loaded?: boolean;
  _load?(req: string, parent: Module): any;
  _resolveFilename?(req: string, parent: Module): string;
  _compile?(contents: string, file: string): any;
} & Mod;

const Module = Mod as any as Module;

declare const global: {
  trvInit: {
    reset: () => void;
  };
  ᚕsrc: (f: string) => string;
};

/**
 * Utilities for registering the bootstrap process. Hooks into module loading/compiling
 */
export class CompileUtil {
  private static ogModuleLoad = Module._load!.bind(Module);
  private static moduleHandlers: ((name: string, o: any) => any)[] = [];

  /**
   * When a module load is requested
   * @param request path to file
   * @param parent parent Module
   */
  private static onModuleLoad(request: string, parent: Module): any {
    let mod: any;
    try {
      mod = this.ogModuleLoad.apply(null, [request, parent]);
      if (parent && !parent.loaded) { // Standard ts compiler output
        const desc = mod ? Object.getOwnPropertyDescriptors(mod) : {};
        if (!mod || !('ᚕtrv' in desc) || 'ᚕtrvError' in desc) {
          try {
            const p = Module._resolveFilename!(request, parent);
            if (p && p.endsWith(TranspileUtil.ext)) {
              throw new Error(`Unable to load ${p}, most likely a cyclical dependency`);
            }
          } catch (err) {
            // Ignore if we can't resolve
          }
        }
      }
    } catch (e) {
      const name = Module._resolveFilename!(request, parent);
      mod = Module._compile!(TranspileUtil.handlePhaseError('load', name, e), name);
    }
    if (this.moduleHandlers) {
      const name = Module._resolveFilename!(request, parent);
      for (const fn of this.moduleHandlers) {
        mod = fn(name, mod);
      }
    }
    return mod;
  }

  /**
   * Compile and Transpile .ts file to javascript
   * @param m node module
   * @param tsf filename
   */
  private static compile(m: Module, tsf: string) {
    return this.compileJavascript(m, TranspileUtil.transpile(tsf), tsf);
  }

  /**
   * Actually compile the content for loading in JS
   */
  static compileJavascript(m: Module, content: string, tsf: string) {
    const jsf = tsf.replace(/[.]ts$/, '.js');
    try {
      return m._compile!(content, jsf);
    } catch (e) {
      content = TranspileUtil.handlePhaseError('compile', tsf, e);
      return m._compile!(content, jsf);
    }
  }

  /**
   * Enable compile support
   */
  static init() {
    if (global.trvInit) {
      return;
    }

    TranspileUtil.init();

    // Registering unix conversion to use for filenames
    global.ᚕsrc = FsUtil.toUnixTs;

    // Tag output to indicate it was succefully processed by the framework
    TranspileUtil.addPreProcessor((__, contents) =>
      `${contents}\nObject.defineProperty(exports, 'ᚕtrv', { configurable: true, value: true });`);

    const resolve = FrameworkUtil.resolvePath;

    // Supports bootstrapping with framework resolution
    Module._load = (req, p) => this.onModuleLoad(resolve(req, p), p);
    require.extensions[TranspileUtil.ext] = (m, tsf) => this.compile(m, resolve(tsf));

    global.trvInit = this;
  }

  /**
   * Add module post processor (post-load)
   *
   * @param handler The code to run on post module load
   */
  static addModuleHandler(handler: (name: string, o: any) => any) {
    this.moduleHandlers.push(handler);
  }

  /**
   * Turn off compile support
   */
  static reset() {
    if (!global.trvInit) {
      return;
    }

    delete require.extensions[TranspileUtil.ext];
    // @ts-ignore
    delete global.trvInit;
    Module._load = this.ogModuleLoad;

    TranspileUtil.reset();
  }
}