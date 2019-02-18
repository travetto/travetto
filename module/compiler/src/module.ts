/// <reference types="node" />

import { Env } from '@travetto/base';

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
    } catch (e) {
      const p = Module._resolveFilename(request, parent);
      if (Env.watch) { // If in a state where imports can come and go
        console.error(`Unable to import ${p}, stubbing out`, e);
      } else if (e) {
        // Marking file as being loaded, useful for the test framework
        require.cache[p] = {};
        throw e;
      }

      mod = {};
    }

    let out = mod;

    // Proxy modules, if in watch mode for non node_modules paths
    if (Env.watch) {
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

    return out as NodeModule;
  }

  compile(m: NodeModule, name: string, content: string) {
    const jsf = name.replace(/[.]ts$/, '.js');

    try {
      (m as any)._compile(content, jsf);
      return true;
    } catch (e) {
      if (Env.watch) { // If attempting to load an optional require
        console.error(`Unable to import ${name}, stubbing out`, e);
        (m as any)._compile(CompilerUtil.EMPTY_MODULE, jsf);
        return false;
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