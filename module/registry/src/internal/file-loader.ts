import { ManifestModuleUtil, RuntimeIndex } from '@travetto/manifest';
import { watchCompiler, WatchEvent, RuntimeContext } from '@travetto/base';

interface ModuleLoader {
  init?(): Promise<void>;
  load(file: string): Promise<void>;
  unload(file: string): Promise<void>;
}

type Handler = (ev: WatchEvent) => unknown;

const VALID_FILE_TYPES = new Set(['js', 'ts']);

/**
 * Listens to file changes, and provides a unified interface for watching file changes, reloading files as needed
 */
class $DynamicFileLoader {
  #handlers: Handler[] = [];
  #loader: ModuleLoader;
  #initialized = false;

  async dispatch(ev: WatchEvent): Promise<void> {
    if (ev.action === 'update' || ev.action === 'delete') {
      await this.#loader.unload(ev.output);
    }
    if (ev.action === 'create' || ev.action === 'delete') {
      RuntimeIndex.reinitForModule(RuntimeContext.main.name);
    }
    if (ev.action === 'create' || ev.action === 'update') {
      await this.#loader.load(ev.output);
    }

    for (const handler of this.#handlers) {
      await handler(ev);
    }
  }

  onLoadEvent(handler: Handler): void {
    this.#handlers.push(handler);
  }

  async init(): Promise<void> {
    if (this.#initialized) {
      return;
    }

    this.#initialized = true;

    // TODO: ESM Support?
    const { DynamicCommonjsLoader } = await import('./commonjs-loader');
    this.#loader = new DynamicCommonjsLoader();

    await this.#loader.init?.();

    const handle = (err: Error): void => {
      if (err && (err.message ?? '').includes('Cannot find module')) { // Handle module reloading
        console.error('Cannot find module', { error: err });
      } else {
        throw err;
      }
    };

    process
      .on('unhandledRejection', handle)
      .on('uncaughtException', handle);

    // Fire off, and let it run in the bg. Restart on exit
    (async (): Promise<void> => {
      for await (const ev of watchCompiler({ restartOnExit: true })) {
        if (ev.file && RuntimeIndex.hasModule(ev.module) && VALID_FILE_TYPES.has(ManifestModuleUtil.getFileType(ev.file))) {
          await this.dispatch(ev);
        }
      }
    })();
  }
}

export const DynamicFileLoader = new $DynamicFileLoader();