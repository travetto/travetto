import * as Mod from 'module';

import { path } from '@travetto/boot';

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
   * Build error module source
   * @param message Error message to show
   * @param isModule Is the error a module that should have been loaded
   * @param base The base set of properties to support
   */
  static getErrorModuleSource(message: string, isModule?: string | boolean, base?: Record<string, string | boolean>): string {
    const f = ([k, v]: string[]): string => `${k}: (t,k) => ${v}`;
    const e = '{ throw new Error(msg); }';
    const map: { [P in keyof ProxyHandler<object>]?: string } = {
      getOwnPropertyDescriptor: base ? '({})' : e,
      get: base ? `{ const v = values[keys.indexOf(k)]; if (!v) ${e} else return v; }` : e,
      has: base ? 'keys.includes(k)' : e
    };
    return [
      (typeof isModule === 'string') ? `console.debug(\`${isModule}\`);` : '',
      base ? `let keys = ['${Object.keys(base).join("','")}']` : '',
      base ? `let values = ['${Object.values(base).join("','")}']` : '',
      `let msg = \`${message}\`;`,
      "Object.defineProperty(exports, 'Ⲑtrv', { value: true })",
      `module.exports = new Proxy({}, { ${Object.entries(map).map(([k, v]) => f([k, v!])).join(',')}});`
    ].join('\n');
  }

  /**
   * Process error response
   * @param phase The load/compile phase to care about
   * @param tsf The typescript filename
   * @param err The error produced
   * @param filename The relative filename
   */
  static handlePhaseError(phase: 'load' | 'compile', tsf: string, err: Error, filename?: string): string {
    filename ??= tsf.replace(path.cwd(), '.');

    if (phase === 'compile' &&
      (err.message.startsWith('Cannot find module') || err.message.startsWith('Unable to load'))
    ) {
      err = new Error(`${err.message} ${err.message.includes('from') ? `[via ${filename}]` : `from ${filename}`}`);
    }

    if (/^(yes|on|1|true)$/i.test(process.env.TRV_DYNAMIC ?? '') && !filename.startsWith('test/')) {
      console.trace(`Unable to ${phase} ${filename}: stubbing out with error proxy.`, err.message);
      return this.getErrorModuleSource(err.message);
    }

    throw err;
  }

  #moduleLoad = Module._load.bind(Module);
  #initialized = false;
  #unloadHandlers: UnloadHandler[] = [];
  #loadHandlers: LoadHandler[] = [];

  /**
   * Check for module cycles
   */
  #checkForCycles(mod: unknown, request: string, parent: NodeJS.Module): void {
    if (parent && !parent.loaded) { // Standard ts compiler output
      const desc = mod ? Object.getOwnPropertyDescriptors(mod) : {};
      if (!mod || !('Ⲑtrv' in desc)) {
        try {
          const p = Module._resolveFilename!(request, parent);
          if (p && !p.includes('node_modules')) {
            throw new Error(`Unable to load ${p}, most likely a cyclical dependency`);
          }
        } catch {
          // Ignore if we can't resolve
        }
      }
    }
  }

  /**
   * When a module load is requested
   * @param request path to file
   * @param parent parent Module
   */
  #onModuleLoad(request: string, parent: NodeJS.Module): unknown {
    let mod: unknown;
    try {
      mod = this.#moduleLoad.apply(null, [request, parent]);
      this.#checkForCycles(mod, request, parent);
    } catch (err: unknown) {
      if (!(err instanceof Error)) {
        throw err;
      }
      const name = Module._resolveFilename!(request, parent);
      mod = Module._compile!($DynamicLoader.handlePhaseError('load', name, err), name);
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

  /**
   * Remove file from require.cache, and possible the file system
   */
  async unload(filename: string, unlink = false): Promise<true | undefined> {
    const native = filename.replace(/[\\\/]+/g, process.platform === 'win32' ? '\\' : '/');
    for (const el of this.#unloadHandlers) {
      el(filename, unlink);
    }
    if (native in require.cache) {
      delete require.cache[native]; // Remove require cached element
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