// @ts-ignore
import * as Mod from 'module';

import { FsUtil } from './fs';
import { EnvUtil } from './env';
import { TranspileUtil } from './transpile';
import { FrameworkUtil } from './framework';

type Module = {
  loaded?: boolean;
  _load?(req: string, parent: Module): any;
  _resolveFilename?(req: string, parent: Module): string;
  _compile?(contents: string, file: string): any;
} & Mod;

const Module = Mod as any as Module;

declare const global: {
  trvInit: {
    libRequire: (x: string) => any;
    reset: () => void;
  };
};

/**
 * Utilities for registering the bootstrap process. Hooks into module loading/compiling
 */
export class CompileUtil {
  private static ogModuleLoad = Module._load!.bind(Module);
  private static moduleHandlers: ((name: string, o: any) => any)[] = [];

  /**
   * The entrypoint for plugins and cli operations to ensure local framework development works
   */
  static libRequire: (x: string) => any;

  /**
   * When a module load is requested
   * @param request path to file
   * @param parent parent Module
   */
  private static onModuleLoad(request: string, parent: Module): any {
    let mod: any;
    try {
      mod = this.ogModuleLoad.apply(null, [request, parent]);
      if (!parent.loaded) { // Standard ts compiler output
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
    const jsf = FsUtil.toJS(tsf);
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

    // Drop typescript import, and use global. Great speedup;
    TranspileUtil.addPreProcessor((name, contents) => {
      if (name.includes('transform')) { // Should only ever be in transformation code
        contents = contents.replace(/^import\s+[*]\s+as\s+ts\s+from\s+'typescript'/g, x => `// ${x}`);
      }
      return contents;
    });

    // Tag output to indicate it was succefully processed by the framework
    TranspileUtil.addPreProcessor((__, contents) =>
      `${contents}\nObject.defineProperty(exports, 'ᚕtrv', { value: true })`);

    // Supports bootstrapping with framework resolution
    if (!EnvUtil.isTrue('TRV_DEV')) {
      this.libRequire = require;
      Module._load = this.onModuleLoad.bind(this);
      require.extensions[TranspileUtil.ext] = this.compile.bind(this);
    } else {
      this.libRequire = x => require(FrameworkUtil.devResolve(x));
      Module._load = (req, p) => this.onModuleLoad(FrameworkUtil.devResolve(req, p), p);
      require.extensions[TranspileUtil.ext] = (m, tsf) => this.compile(m, FrameworkUtil.devResolve(tsf));
    }

    global.trvInit = this;
  }

  /**
   * Add module post processor (post-load)
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
    delete global.trvInit;
    Module._load = this.ogModuleLoad;

    TranspileUtil.reset();
  }
}