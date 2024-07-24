import { Module } from 'node:module';

import { path } from '@travetto/manifest';
import { Env, RuntimeIndex } from '@travetto/base';

import { RetargettingProxy } from '../proxy';

declare module 'module' {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  function _resolveFilename(req: string, parent: typeof Module): string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  function _load(req: string, parent: typeof Module): unknown;
}

type ModuleLoader = typeof Module['_load'];
type ModuleProxy = <T>(file: string, mod?: T) => (T | undefined);

const moduleLoad: ModuleLoader = Module._load.bind(Module);

/**
 * Dynamic commonjs module loader. Hooks into module loading
 */
export class DynamicCommonjsLoader {

  /**
   * Build a module loader
   */
  static buildModuleLoader(proxyModuleLoad?: ModuleProxy): ModuleLoader {
    return (request: string, parent: typeof Module): unknown => {
      let mod: unknown;
      try {
        mod = moduleLoad.apply(null, [request, parent]);
      } catch (err: unknown) {
        const name = Module._resolveFilename!(request, parent);
        if (err instanceof Error && Env.dynamic && !name.startsWith('test/')) {
          const errMsg = err.message;
          console.debug(`Unable to load ${name}: stubbing out with error proxy.`, errMsg);
          const e = (): never => { throw new Error(errMsg); };
          mod = new Proxy({}, { getOwnPropertyDescriptor: e, get: e, has: e });
        } else {
          throw err;
        }
      }

      const file = Module._resolveFilename!(request, parent);
      const src = RuntimeIndex.getEntry(file)?.sourceFile;
      // Only proxy workspace modules
      if (src && RuntimeIndex.getModuleFromSource(src)?.workspace) {
        return proxyModuleLoad ? proxyModuleLoad(file, mod) : mod;
      } else {
        return mod;
      }
    };
  }

  #loader: ModuleLoader;
  #modules = new Map<string, RetargettingProxy<unknown>>();

  #proxyModule<T>(file: string, mod?: T): T | undefined {
    if (!this.#modules.has(file)) {
      this.#modules.set(file, new RetargettingProxy<T>(mod!));
    } else {
      this.#modules.get(file)!.setTarget(mod);
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return this.#modules.get(file)!.get() as T;
  }

  async init(): Promise<void> {
    this.#loader = DynamicCommonjsLoader.buildModuleLoader((file, mod) => this.#proxyModule(file, mod));
  }

  async unload(file: string): Promise<void> {
    const native = path.toNative(file);
    if (native in require.cache) {
      delete require.cache[native]; // Remove require cached element
    }
    this.#proxyModule(file, null);
  }

  async load(file: string): Promise<void> {
    try {
      Module._load = this.#loader;
      require(file);
    } finally {
      Module._load = moduleLoad;
    }
  }
}