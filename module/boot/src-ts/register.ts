// @ts-ignore
import * as Mod from 'module';
import * as path from 'path';

import { FsUtil } from './fs-util';
import { AppCache } from './app-cache';
import { EnvUtil } from './env';
import { TranspileUtil } from './transpile';

type Module = {
  loaded?: boolean;
  _load?(req: string, parent: Module): any;
  _resolveFilename?(req: string, parent: Module): string;
  _compile?(file: string, contents: string): any;
} & Mod;

const Module = Mod as any as Module;

declare const global: {
  trvInit: {
    libRequire: (x: string) => any;
    deinit: () => void;
  };
};

const IS_WATCH = !EnvUtil.isFalse('watch');

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

      if (!parent.loaded && (!mod || !mod.ᚕtrv)) {
        let p;
        try {
          p = Module._resolveFilename!(request, parent);
        } catch (err) {
          // Ignore if we can't resolve
        }
        if (p && p.endsWith('.ts')) {
          throw new Error(`Unable to load ${p}, most likely a cyclical dependency`);
        }
      }

      return mod;
    } catch (e) {
      const p = Module._resolveFilename!(request, parent);

      // Build proxy if watching and not an extension as extensions are allowed to not load
      if (IS_WATCH) {
        console.debug(`Unable to load ${p.replace(`${FsUtil.cwd}/`, '')}: stubbing out with error proxy.`, e.message);
        return this.getErrorModuleProxy(e.message) as NodeModule;
      }

      throw e;
    }
  }

  private static compile(m: Module, tsf: string) {
    const content = TranspileUtil.transpile(tsf);
    return m._compile!(content, FsUtil.toJS(tsf));
  }

  static getErrorModuleProxy(err: string) {
    const onError = () => {
      throw new Error(err);
    };
    return new Proxy({}, {
      enumerate: () => [],
      isExtensible: () => false,
      getOwnPropertyDescriptor: () => ({}),
      preventExtensions: () => true,
      apply: onError,
      construct: onError,
      setPrototypeOf: onError,
      getPrototypeOf: onError,
      get: onError,
      has: onError,
      set: onError,
      ownKeys: onError,
      deleteProperty: onError,
      defineProperty: onError
    });
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
            this.devCache[name] = `${pre}/${name}`;
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

    AppCache.init();

    // Supports bootstrapping with framework resolution
    if (!EnvUtil.isTrue('trv_dev')) {
      this.libRequire = require;
      Module._load = this.onModuleLoad.bind(this);
      require.extensions['.ts'] = this.compile.bind(this);
    } else {
      this.libRequire = x => require(this.devResolve(x));
      Module._load = (req, p) => this.onModuleLoad(this.devResolve(req, p), p);
      require.extensions['.ts'] = (m, tsf) => this.compile(m, this.devResolve(tsf));
    }

    global.trvInit = this;
  }

  static deinit() {
    if (!global.trvInit) {
      return;
    }

    TranspileUtil.reset();
    delete require.extensions['.ts'];
    delete global.trvInit;
    Module._load = this.ogModuleLoad;

    for (const k of Object.keys(require.cache)) {
      if (k.includes('@travetto')) { // If a travetto module
        delete require.cache[k];
      }
    }
  }
}