import { FsUtil } from './fs-util';
import { Env, } from './env';
import { AppCache } from './cache';
// @ts-ignore
import * as Module from 'module';

let tsOpts: any;

let ts: any;

class RegisterUtil {
  // @ts-ignore
  private static ogModuleLoad = Module._load.bind(Module);

  static moduleLoaderHandler(request: string, parent: Module) {
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
  }

  static compileTypescript(m: Module, tsf: string) {
    const name = FsUtil.toUnix(tsf);

    let content;
    if (!AppCache.hasEntry(name)) {
      if (!tsOpts) {
        const json = ts.readJsonConfigFile(`${Env.cwd}/tsconfig.json`, ts.sys.readFile);
        tsOpts = ts.parseJsonSourceFileConfigFileContent(json, ts.sys, Env.cwd).options;
      }

      content = ts.transpile(FsUtil.prepareTranspile(tsf), tsOpts);
      AppCache.writeEntry(name, content);
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

  static registerLoaders() {
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
  }
}

export const registerLoaders = RegisterUtil.registerLoaders.bind(RegisterUtil);