/// <reference types="node" />

import { Env } from '@travetto/boot';
import { AppError } from '@travetto/base';

import { RetargettingHandler } from './proxy';
import { CompilerUtil } from './util';

declare namespace NodeJS {
  class Module {
    static _resolveFilename(request: string, parent: NodeModule): string;
    static _load(request: string, parent: NodeModule): NodeModule;
  }
}

const Module = require('module') as typeof NodeJS.Module;

const originalLoader = Module._load.bind(Module);

export class ModuleManager {
  private modules = new Map<string, { module?: any, proxy?: any, handler?: RetargettingHandler<any> }>();

  constructor(private cwd: string) { }

  init() {
    Module._load = this.load.bind(this);
  }

  load(request: string, parent: NodeModule) {
    let mod;
    try {
      mod = originalLoader.apply(null, [request, parent]);
    } catch (e) { // Failed due to compilation error
      const p = Module._resolveFilename(request, parent);

      if (!Env.watch || p.includes('/extension/')) {
        throw e;
      }

      console.debug(`Unable to load ${p.replace(`${Env.cwd}/`, '')}: stubbing out with error proxy.`, e.message);
      mod = CompilerUtil.getErrorModuleProxy(e.message);
    }

    let out = mod;

    // Proxy modules, if in watch mode for non node_modules paths
    if (Env.watch) {
      const p = Module._resolveFilename(request, parent);
      if (p.includes(this.cwd) && !p.includes('node_modules')) {
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

    return out as NodeModule;
  }

  compile(m: NodeModule, name: string, content: string) {
    const jsf = name.replace(/[.]ts$/, '.js');

    try {
      return (m as any)._compile(content, jsf);
    } catch (e) {
      if (e.message.startsWith('Cannot find module') || e.message.startsWith('Unable to load')) {
        const modName = m.filename.replace(`${this.cwd}/`, '');
        const err = new AppError(`${e.message} ${e.message.includes('from') ? `[via ${modName}]` : `from ${modName}`}`, 'general');
        e = err;
      }
      throw e;
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