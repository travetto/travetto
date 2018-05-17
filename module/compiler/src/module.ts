import { RetargettingHandler } from './proxy';
import { AppEnv } from '@travetto/base';
import { CompilerUtil } from './util';

const Module = require('module');

const originalLoader = Module._load.bind(Module);

export class ModuleManager {
  private modules = new Map<string, { module?: any, proxy?: any, handler?: RetargettingHandler<any> }>();

  constructor(private cwd: string) {
    Module._load = this.load.bind(this);
  }

  load(request: string, parent: string) {

    let mod;
    try {
      mod = originalLoader.apply(null, arguments);
    } catch (e) {
      const p = Module._resolveFilename(request, parent);

      if (!AppEnv.prod) { // If attempting to load an optional require
        console.error(`Unable to import ${p}, stubbing out`, e);
      } else {
        if (e) {
          throw e;
        }
      }

      mod = {};
    }

    let out = mod;

    // Proxy modules, if in watch mode for non node_modules paths
    if (AppEnv.watch) {
      const p = Module._resolveFilename(request, parent);
      if (p.includes(this.cwd) && !p.includes(CompilerUtil.LIBRARY_PATH)) {
        if (!this.modules.has(p)) {
          const handler = new RetargettingHandler(mod);
          out = new Proxy({}, handler);
          this.modules.set(p, { module: out, handler });
        } else {
          const conf = this.modules.get(p)!;
          conf.handler!.target = mod;
          out = conf.module!;
        }
      }
    }

    return out;
  }

  compile(m: NodeModule, name: string, content: string) {
    const isNew = !this.modules.has(name);
    const jsf = name.replace(/[.]ts$/, '.js');

    try {
      const ret = (m as any)._compile(content, jsf);
      return ret;
    } catch (e) {
      if (!AppEnv.prod) { // If attempting to load an optional require
        console.error(`Unable to import ${name}, stubbing out`, e);

        (m as any)._compile(CompilerUtil.EMPTY_MODULE, jsf);

        return CompilerUtil.EMPTY_MODULE;
      } else {
        throw e;
      }
    }

  }

  unload(fileName: string) {
    if (this.modules.has(fileName)) {
      this.modules.get(fileName)!.handler!.target = null;
    }
  }

  clear() {
    this.modules.clear();
  }
}