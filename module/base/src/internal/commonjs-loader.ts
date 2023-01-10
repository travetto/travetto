import { Module } from 'module';
import { RootIndex } from '@travetto/manifest';

import { GlobalEnv } from '../global-env';
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
        if (err instanceof Error && GlobalEnv.dynamic && !name.startsWith('test/')) {
          const errMsg = err.message;
          console.debug(`Unable to load ${name}: stubbing out with error proxy.`, errMsg);
          const e = (): never => { throw new Error(errMsg); };
          mod = new Proxy({}, { getOwnPropertyDescriptor: e, get: e, has: e });
        } else {
          throw err;
        }
      }

      const fileName = Module._resolveFilename!(request, parent);
      // Only proxy local modules
      if (RootIndex.getModuleFromSource(fileName)?.local) {
        return proxyModuleLoad ? proxyModuleLoad(fileName, mod) : mod;
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
    const native = file.replace(/[\\\/]+/g, process.platform === 'win32' ? '\\' : '/');
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