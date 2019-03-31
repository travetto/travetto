/// <reference types="typescript/lib/typescript" />

// @ts-ignore
import * as Module from 'module';
import { FsUtil } from './fs-util';
import { AppCache } from './cache';
import { Env } from './env';

const cwd = Env.cwd;

// @ts-ignore
let ts = global.ts = new Proxy({}, {
  get(t, p, r) {
    ts = (global as any)['ts'] = require('typescript');
    return ts[p];
  }
});

// @ts-ignore
const ogModuleLoad = Module._load.bind(Module);

class Register {
  static opts: any;

  static moduleLoaderHandler(request: string, parent: Module) {

    const mod = ogModuleLoad.apply(null, [request, parent]);

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
  }

  static transpile(tsf: string) {
    if (!this.opts) {
      const json = ts.readJsonConfigFile(`${cwd}/tsconfig.json`, ts.sys.readFile);
      this.opts = ts.parseJsonSourceFileConfigFileContent(json, ts.sys, cwd).options;
    }
    const name = FsUtil.toUnix(tsf);
    const content = ts.transpile(FsUtil.prepareTranspile(tsf), this.opts);
    AppCache.writeEntry(name, content);
    return content;
  }

  static compileTypescript(m: Module, tsf: string) {
    const name = FsUtil.toUnix(tsf);

    let content;
    if (!AppCache.hasEntry(name)) {
      content = this.transpile(tsf);
    } else {
      content = AppCache.readEntry(name);
    }

    // @ts-ignore
    const r = m._compile(content, tsf.replace(/\.ts$/, '.js'));
    return r;
  }

  static frameworkModuleHandler(request: string, parent: Module) {
    // @ts-ignore
    const resolved = Module._resolveFilename(request, parent);

    if (/^[.\/]/.test(request) || request.startsWith('@travetto')) { // If relative or framework
      request = FsUtil.resolveFrameworkDevFile(resolved);
    }

    return this.moduleLoaderHandler(request, parent);
  }

  static frameworkCompileTypescript(m: Module, tsf: string) {
    return this.compileTypescript(m, FsUtil.resolveFrameworkDevFile(tsf));
  }
  static register() {
    AppCache.init();

    const tfd = !!process.env.TRV_FRAMEWORK_DEV;

    // @ts-ignore
    Module._load = (tfd ? this.frameworkModuleHandler : this.moduleLoaderHandler).bind(this);
    require.extensions['.ts'] = (tfd ? this.frameworkCompileTypescript : this.compileTypescript).bind(this);

    Env.show();
  }
}

export const register = () => Register.register();