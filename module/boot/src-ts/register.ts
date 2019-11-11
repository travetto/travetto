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
  }
};

export class RegisterUtil {
  // @ts-ignore
  static ogModuleLoad = Module._load.bind(Module);
  static pkgName: string;
  static plainLogs = EnvUtil.isTrue('plain_logs');
  static libRequire: (x: string) => any;

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

  static computeModuleFromFile(fileName: string) {
    /** @type string */
    let mod = FsUtil.toUnix(fileName);

    let ns = '@sys';

    if (mod.includes(FsUtil.cwd)) {
      mod = mod.split(FsUtil.cwd)[1].replace(/^[\/]+/, '');
      ns = '@app';
    }

    if (mod.startsWith('node_modules')) {
      mod = mod.split('node_modules').pop()!.replace(/^[\/]+/, '');
    }

    if (mod.startsWith('@')) {
      const [ns1, ns2, ...rest] = mod.split(/[\/]/);
      ns = `${ns1}:${ns2}`.replace('@travetto', '@trv');
      if (rest[0] === 'src') {
        rest.shift();
      }
      mod = rest.join('.');
    }

    mod = mod
      .replace(/[\/]+/g, '.')
      .replace(/^\./, '')
      .replace(/\.(t|j)s$/, '');

    return `${ns}/${mod}`;
  }

  static prepareTranspile(fileName: string, contents?: string) {
    let fileContents = contents || fs.readFileSync(fileName, 'utf-8');

    let line = 1;

    // Insert filename into all log statements for all components, when logger isn't loaded
    if (!this.plainLogs && !fileName.includes('/cli/') && !fileName.includes('/bin/')) {
      fileContents = fileContents.replace(/(\bconsole[.](debug|info|trace|warn|log|error)[(])|\n/g, a => {
        if (a === '\n') {
          line += 1;
          return a;
        } else {
          return `${a}'[${this.computeModuleFromFile(fileName)}:${line.toString().padStart(3)}]',`;
        }
      });
    }

    // Drop typescript import, and use global. Great speedup;
    fileContents = fileContents.replace(/import\s+[*]\s+as\s+ts\s+from\s+'typescript'/g, x => `// ${x}`);

    return `${fileContents};\nexport const __$TRV = 1;`;
  }

  static resolveFrameworkDevFile(pth: string) {
    if (pth.includes('@travetto')) {
      if (!this.pkgName) {
        this.pkgName = require(FsUtil.joinUnix(FsUtil.cwd, 'package.json')).name;
      }
      pth = FsUtil.toUnix(pth).replace(/^.*\/@travetto\/([^/]+)(\/([^@]+)?)?$/g, (all, name, rest) => {
        const mid = this.pkgName === `@travetto/${name}` ? '' : `node_modules/@travetto/${name}`;
        return `${FsUtil.cwd}/${mid}${rest || ''}`.replace(/\/\/+/g, '/');
      });
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

      if (EnvUtil.isTrue('watch') && !p.includes('/extension/')) { // Build proxy if watching and not an extension
        console.debug(`Unable to load ${p.replace(`${process.cwd()}/`, '')}: stubbing out with error proxy.`, e.message);
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
    if (/^[.\/]/.test(request) || request.startsWith('@travetto')) { // If relative or framework
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

    const tfd = !!process.env.TRV_FRAMEWORK_DEV;

    // @ts-ignore
    Module._load = (tfd ? this.frameworkModuleHandler : this.moduleLoaderHandler).bind(this);
    // @ts-ignore
    require.extensions['.ts'] = (tfd ? this.frameworkCompileTypescript : this.compileTypescript).bind(this);

    this.libRequire = tfd ? x => require(this.resolveFrameworkDevFile(`/${x}`)) : require;

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
      if (k.includes('@travetto')) {
        delete require.cache[k];
      }
    }
  }
}