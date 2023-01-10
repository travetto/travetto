import { Module as Mod } from 'module';

import { GlobalEnv } from '../global-env';

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export const Module: NodeModule = Mod as unknown as NodeModule;

type UnloadHandler = (file: string, unlink?: boolean) => void;
type LoadHandler<T = unknown> = (name: string, o: T) => T;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    // eslint-disable-next-line no-shadow
    interface Module {
      _load(req: string, parent: Module): unknown;
      _resolveFilename(req: string, parent: Module): string;
      _compile(contents: string, file: string): unknown;
    }
  }
  interface NodeModule {
    _load(req: string, parent: NodeModule): unknown;
    _resolveFilename(req: string, parent: NodeModule): string;
    _compile(contents: string, file: string): unknown;
  }
}

/**
 * Dynamic module loader. Hooks into module loading
 */
export class $DynamicLoader {

  /**
   * Build error module module
   */
  static getErrorModule(message: string): unknown {
    const e = (): never => { throw new Error(message); };
    return new Proxy({}, { getOwnPropertyDescriptor: e, get: e, has: e });
  }

  #moduleLoad = Module._load.bind(Module);
  #initialized = false;
  #unloadHandlers: UnloadHandler[] = [];
  #loadHandlers: LoadHandler[] = [];

  /**
   * When a module load is requested
   * @param request path to file
   * @param parent parent Module
   */
  #onModuleLoad(request: string, parent: NodeJS.Module): unknown {
    let mod: unknown;
    try {
      mod = this.#moduleLoad.apply(null, [request, parent]);
    } catch (err: unknown) {
      if (!(err instanceof Error)) {
        throw err;
      }
      const name = Module._resolveFilename!(request, parent);
      if (!GlobalEnv.dynamic || name.startsWith('test/')) {
        throw err;
      }
      console.debug(`Unable to load ${name}: stubbing out with error proxy.`, err.message);
      return $DynamicLoader.getErrorModule(err.message);
    }

    if (this.#loadHandlers.length) {
      const name = Module._resolveFilename!(request, parent);
      for (const handler of this.#loadHandlers) {
        mod = handler(name, mod);
      }
    }

    return mod;
  }

  /**
   * Listen for when files are unloaded
   * @param handler
   */
  onUnload(handler: UnloadHandler): void {
    this.#unloadHandlers.push(handler);
  }

  /**
   * Add module post processor (post-load)
   *
   * @param handler The code to run on post module load
   */
  onLoad(handler: LoadHandler): void {
    this.#loadHandlers.push(handler);
  }

  /**
   * Clear all unload handlers
   * @private
   */
  clearHandlers(): void {
    this.#loadHandlers = [];
    this.#unloadHandlers = [];
  }

  /**
   * Enable compile support
   */
  init(): void {
    if (this.#initialized) {
      return;
    }

    Module._load = (req, p): unknown => this.#onModuleLoad(req, p);

    this.#initialized = true;
  }

  isLoaded(file: string): string | undefined {
    const native = file.replace(/[\\\/]+/g, process.platform === 'win32' ? '\\' : '/');
    return native in require.cache ? native : undefined;
  }

  /**
   * Remove file from require.cache, and possible the file system
   */
  async unload(filename: string, unlink = false): Promise<true | undefined> {
    for (const el of this.#unloadHandlers) {
      el(filename, unlink);
    }
    const loadedFile = this.isLoaded(filename);
    if (loadedFile) {
      delete require.cache[loadedFile]; // Remove require cached element
      return true;
    }
  }

  /**
   * Load a file
   */
  async load(filename: string): Promise<void> {
    require(filename);
  }

  /**
   * Reload a file
   * @param filename
   */
  async reload(filename: string): Promise<void> {
    await this.unload(filename);
    await this.load(filename);
  }
}

export const DynamicLoader = new $DynamicLoader();