/// <reference path="./types.d.ts" />

// @ts-ignore
import * as Module from 'module';
import * as fs from 'fs';

import { FsUtil } from './fs-util';
import { AppCache } from './app-cache';
import { EnvUtil } from './env';

let tsOpts: any;

let ts: any;

declare const global: {
  ts: any;
  trvInit: {
    libRequire: (x: string) => any;
    deinit: () => void;
  };
};

type Preparer = (name: string, contents: string) => string;

const IS_WATCH = !EnvUtil.isFalse('watch');

export class RegisterUtil {
  private static preparers: Preparer[] = [];

  // @ts-ignore
  static ogModuleLoad = Module._load.bind(Module);
  static pkgName: string;
  static libRequire: (x: string) => any;

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
  static resolveFrameworkDevFile(pth: string) {
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

  static moduleLoaderHandler(request: string, parent: Module) {
    try {
      const mod = this.ogModuleLoad.apply(null, [request, parent]);

      if (!parent.loaded && (!mod || !mod.__$TRV)) {
        let p;
        try {
          // @ts-ignore
          p = Module._resolveFilename(request, parent);
        } catch (err) {
          // Ignore if we can't resolve
        }
        if (p && p.endsWith('.ts')) {
          throw new Error(`Unable to load ${p}, most likely a cyclical dependency`);
        }
      }

      return mod;
    } catch (e) {
      // @ts-ignore
      const p = Module._resolveFilename(request, parent);

      // Build proxy if watching and not an extension as extensions are allowed to not load
      if (IS_WATCH && !p.includes('/extension/')) {
        console.debug(`Unable to load ${p.replace(`${FsUtil.cwd}/`, '')}: stubbing out with error proxy.`, e.message);
        return this.getErrorModuleProxy(e.message) as NodeModule;
      }

      throw e;
    }
  }

  static compileTypescript(m: Module, tsf: string) {
    const name = FsUtil.toUnix(tsf);

    let content;
    if (!AppCache.hasEntry(name)) {
      if (!tsOpts) {
        const json = ts.readJsonConfigFile(`${FsUtil.cwd}/tsconfig.json`, ts.sys.readFile);
        tsOpts = ts.parseJsonSourceFileConfigFileContent(json, ts.sys, FsUtil.cwd).options;
      }

      content = ts.transpile(this.prepareTranspile(tsf), tsOpts);
      AppCache.writeEntry(name, content);
    } else {
      content = AppCache.readEntry(name);
    }

    // @ts-ignore
    const r = m._compile(content, tsf.replace(/\.ts$/, '.js'));
    return r;
  }

  static frameworkModuleHandler(request: string, parent: Module) {
    // If relative or framework
    if (/^[.\/]/.test(request) || request.startsWith('@travetto')) {
      // @ts-ignore
      const resolved = Module._resolveFilename(request, parent);
      request = this.resolveFrameworkDevFile(resolved);
    }

    return this.moduleLoaderHandler(request, parent);
  }

  static frameworkCompileTypescript(m: Module, tsf: string) {
    return this.compileTypescript(m, this.resolveFrameworkDevFile(tsf));
  }

  static init() {
    if (global.trvInit) {
      return;
    }

    // @ts-ignore
    ts = global.ts = new Proxy({}, {
      get(t, p, r) {
        ts = (global as any).ts = require('typescript');
        return ts[p];
      }
    });

    AppCache.init();

    // Define
    Object.defineProperty(global, 'TRV_FRAMEWORK_DEV', {
      value: EnvUtil.isSet('trv_framework_dev'),
      writable: false,
      configurable: true,
      enumerable: false
    });

    // @ts-ignore
    Module._load = (TRV_FRAMEWORK_DEV ? this.frameworkModuleHandler : this.moduleLoaderHandler).bind(this);
    // @ts-ignore
    require.extensions['.ts'] = (TRV_FRAMEWORK_DEV ? this.frameworkCompileTypescript : this.compileTypescript).bind(this);

    // Supports bootstrapping with framework resolution
    this.libRequire = TRV_FRAMEWORK_DEV ? x => require(this.resolveFrameworkDevFile(`/${x}`)) : require;

    global.trvInit = this;
  }

  static deinit() {
    if (!global.trvInit) {
      return;
    }

    delete require.extensions['.ts'];
    delete global.trvInit;
    // @ts-ignore
    Module._load = this.ogModuleLoad;

    for (const k of Object.keys(require.cache)) {
      if (k.includes('@travetto')) { // If a travetto module
        delete require.cache[k];
      }
    }
  }
}