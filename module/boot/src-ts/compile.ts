// @ts-ignore
import * as Mod from 'module';

import { TranspileUtil } from './transpile';
import { FsUtil } from './fs';
import { EnvUtil } from './env';
import { Package } from './package';

type Module = {
  loaded?: boolean;
  _load?(req: string, parent: Module): unknown;
  _resolveFilename?(req: string, parent: Module): string;
  _compile?(contents: string, file: string): unknown;
} & NodeJS.Module;

// eslint-disable-next-line @typescript-eslint/no-redeclare
const Module = Mod as unknown as Module;

declare const global: {
  trvInit?: {
    reset: () => void;
  };
  ᚕsrc: (f: string) => string;
};

/**
 * Utilities for registering the bootstrap process. Hooks into module loading/compiling
 */
export class CompileUtil {
  private static ogModuleLoad = Module._load!.bind(Module);
  private static ogResolveFilename = Module._resolveFilename!.bind(Module);
  private static moduleHandlers: ((name: string, o: unknown) => unknown)[] = [];

  /**
   * When a module load is requested
   * @param request path to file
   * @param parent parent Module
   */
  private static onModuleLoad(request: string, parent: Module): unknown {
    let mod: unknown;
    try {
      mod = this.ogModuleLoad.apply(null, [request, parent]);
      if (parent && !parent.loaded) { // Standard ts compiler output
        const desc = mod ? Object.getOwnPropertyDescriptors(mod) : {};
        if (!mod || !('ᚕtrv' in desc) || 'ᚕtrvError' in desc) {
          try {
            const p = Module._resolveFilename!(request, parent);
            if (p && p.endsWith(TranspileUtil.EXT)) {
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
   * Resolve filename for dev mode
   */
  private static devResolveFilename(p: string, m: Module) {
    if (p.includes('@travetto')) {
      const [, key, sub] = p.match(/^.*(@travetto\/[^/]+)(\/?.*)?$/) ?? [];
      const match = EnvUtil.getDynamicModules()[key!];
      if (match) {
        p = `${match}${sub! ?? ''}`;
      } else {
        if (key === Package.name) {
          p = FsUtil.resolveUnix(sub ? `./${sub}` : Package.main);
        }
      }
    }
    return this.ogResolveFilename(p, m);
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

    // Only do for dev
    if (process.env.TRV_DEV) {
      Module._resolveFilename = this.devResolveFilename.bind(this);
    }

    // Tag output to indicate it was succefully processed by the framework
    TranspileUtil.addPreProcessor((__, contents) =>
      `${contents}\nObject.defineProperty(exports, 'ᚕtrv', { configurable: true, value: true });`);

    // Supports bootstrapping with framework resolution
    Module._load = (req, p) => this.onModuleLoad(req, p);
    require.extensions[TranspileUtil.EXT] = (m, tsf) => this.compile(m, Module._resolveFilename!(tsf, Module));

    global.trvInit = this;
  }

  /**
   * Add module post processor (post-load)
   *
   * @param handler The code to run on post module load
   */
  static addModuleHandler(handler: (name: string, o: unknown) => unknown) {
    this.moduleHandlers.push(handler);
  }

  /**
   * Turn off compile support
   */
  static reset() {
    if (!global.trvInit) {
      return;
    }

    delete require.extensions[TranspileUtil.EXT];
    delete global.trvInit;
    Module._load = this.ogModuleLoad;
    Module._resolveFilename = this.ogResolveFilename;

    TranspileUtil.reset();
  }
}