// @ts-ignore
import * as Mod from 'module';
import * as path from 'path';
import * as fs from 'fs';

import { FsUtil } from './fs-util';
import { EnvUtil } from './env';
import { TranspileUtil } from './transpile';

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
    deinit: () => void;
  };
};

/**
 * Utilities for registering the bootstrap process. Hooks into module loading/compiling
 */
export class RegisterUtil {
  private static ogModuleLoad = Module._load!.bind(Module);

  private static readonly devCache = {
    boot: path.resolve(__dirname, '..'),
    [require(FsUtil.joinUnix(FsUtil.cwd, 'package.json')).name.split('/')[1]]: FsUtil.cwd // Initial
  };

  static libRequire: (x: string) => any;

  private static onModuleLoad(request: string, parent: Module): any {
    try {
      const mod = this.ogModuleLoad.apply(null, [request, parent]);
      if (!parent.loaded && (!mod || !mod.ᚕtrv)) { // Standard ts compiler output
        let p = mod.filename || mod.id;
        try {
          p = p || Module._resolveFilename!(request, parent);
        } catch (err) {
          // Ignore if we can't resolve
        }
        if (p && p.endsWith(TranspileUtil.ext)) {
          throw new Error(`Unable to load ${p}, most likely a cyclical dependency`);
        }
      }

      return mod;
    } catch (e) {
      const name = Module._resolveFilename!(request, parent);
      return Module._compile!(TranspileUtil.handlePhaseError('load', name, e), name);
    }
  }

  private static compile(m: Module, tsf: string) {
    return this.doCompile(m, TranspileUtil.transpile(tsf), tsf);
  }

  static doCompile(m: Module, content: string, tsf: string) {
    const jsf = FsUtil.toJS(tsf);
    try {
      return m._compile!(content, jsf);
    } catch (e) {
      content = TranspileUtil.handlePhaseError('compile', tsf, e);
      return m._compile!(content, jsf);
    }
  }

  /**
   * Only called in Framework dev mode
   * @param pth
   */
  static devResolve(pth: string, mod?: Module) {
    if (mod) {
      try {
        pth = Module._resolveFilename!(pth, mod);
      } catch{ }
    }

    if (/travetto[^/]*\/module\/[^/]+\/bin/.test(pth)) { // Convert bin from framework module
      pth = `${FsUtil.cwd}/node_modules/@travetto/${pth.split(/\/module\//)[1]}`;
    }

    // If relative or framework
    if (pth.includes('@travetto')) {
      // Fetch current module's name
      // Handle self references
      pth = FsUtil.toUnix(pth)
        .replace(/^(.*\/@travetto)\/([^/]+)(\/[^@]*)?$/g, (all, pre, name, rest) => {
          if (!(name in this.devCache)) {
            const base = `${FsUtil.cwd}/node_modules/@travetto/${name}`;
            this.devCache[name] = fs.existsSync(base) ? base : `${pre}/${name}`;
          }
          return `${this.devCache[name]}${rest ? `/${rest}` : ''}`;
        })
        .replace(/\/\/+/g, '/'); // De-dupe
    }
    return pth;
  }

  static init() {
    if (global.trvInit) {
      return;
    }

    TranspileUtil.init();

    // Supports bootstrapping with framework resolution
    if (!EnvUtil.isTrue('TRV_DEV')) {
      this.libRequire = require;
      Module._load = this.onModuleLoad.bind(this);
      require.extensions[TranspileUtil.ext] = this.compile.bind(this);
    } else {
      this.libRequire = x => require(this.devResolve(x));
      Module._load = (req, p) => this.onModuleLoad(this.devResolve(req, p), p);
      require.extensions[TranspileUtil.ext] = (m, tsf) => this.compile(m, this.devResolve(tsf));
    }

    global.trvInit = this;
  }

  static deinit() {
    if (!global.trvInit) {
      return;
    }

    delete require.extensions[TranspileUtil.ext];
    delete global.trvInit;
    Module._load = this.ogModuleLoad;

    TranspileUtil.reset();
  }
}