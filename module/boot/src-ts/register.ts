/// <reference path="./types.d.ts" />

// @ts-ignore
import * as Mod from 'module';
import * as fs from 'fs';

import { FsUtil } from './fs-util';
import { AppCache } from './app-cache';
import { EnvUtil } from './env';

type Module = {
  loaded?: boolean;
  _load?(req: string, parent: Module): any;
  _resolveFilename?(req: string, parent: Module): string;
  _compile?(file: string, contents: string): any;
} & Mod;

const Module = Mod as any as Module;

type Preparer = (name: string, contents: string) => string;

let tsOpts: any;
let ts: any;

declare const global: {
  ts: any;
  trvInit: {
    libRequire: (x: string) => any;
    deinit: () => void;
  };
};

const IS_WATCH = !EnvUtil.isFalse('watch');

// Define
Object.defineProperty(global, 'TRV_FRAMEWORK_DEV', {
  value: EnvUtil.isSet('trv_framework_dev'),
  writable: false,
  configurable: true,
  enumerable: false
});

export class RegisterUtil {
  private static preparers: Preparer[] = [];

  private static ogModuleLoad = Module._load!.bind(Module);
  private static pkgName: string;

  static libRequire: (x: string) => any;

  private static onModuleLoad(request: string, parent: Module): any {
    try {
      const mod = this.ogModuleLoad.apply(null, [request, parent]);

      if (!parent.loaded && (!mod || !mod.__$TRV)) {
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
      if (IS_WATCH && !p.includes('/extension/')) {
        console.debug(`Unable to load ${p.replace(`${FsUtil.cwd}/`, '')}: stubbing out with error proxy.`, e.message);
        return this.getErrorModuleProxy(e.message) as NodeModule;
      }

      throw e;
    }
  }

  private static compile(m: Module, tsf: string) {
    const content = this.transpile(tsf);
    return m._compile!(content, tsf.replace(/\.ts$/, '.js'));
  }

  static addPreparer(fn: Preparer) {
    this.preparers.push(fn);
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

  static prepareTranspile(fileName: string, contents?: string) {
    let fileContents = contents || fs.readFileSync(fileName, 'utf-8');

    for (const preparer of this.preparers) {
      fileContents = preparer(fileName, fileContents);
    }

    // Drop typescript import, and use global. Great speedup;
    fileContents = fileContents.replace(/import\s+[*]\s+as\s+ts\s+from\s+'typescript'/g, x => `// ${x}`);

    // Track loading, for cyclical dependency detection
    return `${fileContents};\nexport const __$TRV = 1;`;
  }

  /**
   * Only called in Framework dev mode
   * @param pth
   */
  static resolveForFramework(pth: string, mod?: Module) {
    if (mod) {
      pth = Module._resolveFilename!(pth, mod);
    }

    // If relative or framework
    if (pth.includes('@travetto')) {
      // Fetch current module's name
      this.pkgName = this.pkgName ||
        require(FsUtil.joinUnix(FsUtil.cwd, 'package.json')).name;

      // Handle self references
      pth = FsUtil.toUnix(pth)
        .replace(/^.*\/@travetto\/([^/]+)(\/([^@]+)?)?$/g, (all, name, rest) => {
          rest = rest ?? '';
          if (this.pkgName !== `@travetto/${name}`) { // If not self, node_modules
            rest = `node_modules/@travetto/${name}/${rest}`;
          }
          return `${FsUtil.cwd}/${rest}`;
        })
        .replace(/\/\/+/g, '/'); // De-dupe
    }
    return pth;
  }

  static transpile(tsf: string, force = false) {
    const name = FsUtil.toUnix(tsf);
    if (force || !AppCache.hasEntry(name)) {
      if (!tsOpts) {
        const json = ts.readJsonConfigFile(`${FsUtil.cwd}/tsconfig.json`, ts.sys.readFile);
        tsOpts = ts.parseJsonSourceFileConfigFileContent(json, ts.sys, FsUtil.cwd).options;
      }
      const content = ts.transpile(this.prepareTranspile(tsf), tsOpts);
      AppCache.writeEntry(name, content);
      return content;
    } else {
      return AppCache.readEntry(name);
    }
  }

  static init() {
    if (global.trvInit) {
      return;
    }

    ts = global.ts = new Proxy({}, {
      get(t, p, r) {
        ts = (global as any).ts = require('typescript');
        return ts[p];
      }
    });

    AppCache.init();

    // Supports bootstrapping with framework resolution
    this.libRequire = !TRV_FRAMEWORK_DEV ? require :
      x => require(this.resolveForFramework(`/${x}`));
    Module._load = !TRV_FRAMEWORK_DEV ? this.onModuleLoad.bind(this) :
      (req, p) => this.onModuleLoad(this.resolveForFramework(req, p), p);
    require.extensions['.ts'] = !TRV_FRAMEWORK_DEV ? this.compile.bind(this) :
      (m, tsf) => this.compile(m, this.resolveForFramework(tsf));

    global.trvInit = this;
  }

  static deinit() {
    if (!global.trvInit) {
      return;
    }

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