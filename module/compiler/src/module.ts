/// <reference types="node" />

import { Env, AppError } from '@travetto/base';

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

  constructor(private cwd: string) { }

  init() {
    Module._load = this.load.bind(this);
  }

  load(request: string, parent: NodeModule) {
    try {
      return originalLoader.apply(null, [request, parent]);
    } catch (e) { // Failed due to compilation error
      const p = Module._resolveFilename(request, parent);

      if (!Env.watch || p.includes('/extension/')) { // Do not build proxy if an extension, let error bubble up
        throw e;
      }

      console.debug(`Unable to load ${p.replace(`${Env.cwd}/`, '')}: stubbing out with error proxy.`, e.message);
      return CompilerUtil.getErrorModuleProxy(e.message) as NodeModule;
    }
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
}