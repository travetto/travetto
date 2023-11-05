import { ManifestModuleUtil, RootIndex } from '@travetto/manifest';
import { ShutdownManager, CompilerClient } from '@travetto/base';

type WatchHandler = Parameters<CompilerClient['onFileChange']>[0];
type CompilerWatchEvent = Parameters<WatchHandler>[0];
interface ModuleLoader {
  init?(): Promise<void>;
  load(file: string): Promise<void>;
  unload(file: string): Promise<void>;
}

const VALID_FILE_TYPES = new Set(['js', 'ts']);

/**
 * Listens to file changes, and provides a unified interface for watching file changes, reloading files as needed
 */
class $DynamicFileLoader {
  #handlers: WatchHandler[] = [];
  #loader: ModuleLoader;
  #initialized = false;

  async dispatch(ev: CompilerWatchEvent): Promise<void> {
    if (ev.action === 'update' || ev.action === 'delete') {
      await this.#loader.unload(ev.output);
    }
    if (ev.action === 'create' || ev.action === 'delete') {
      RootIndex.reinitForModule(RootIndex.mainModuleName);
    }
    if (ev.action === 'create' || ev.action === 'update') {
      await this.#loader.load(ev.output);
    }

    for (const handler of this.#handlers) {
      await handler(ev);
    }
  }

  onLoadEvent(handler: WatchHandler): void {
    this.#handlers.push(handler);
  }

  async init(): Promise<void> {
    if (this.#initialized) {
      return;
    }

    this.#initialized = true;

    // TODO: ESM Support?
    const { DynamicCommonjsLoader } = await import('./commonjs-loader.js');
    this.#loader = new DynamicCommonjsLoader();

    await this.#loader.init?.();

    ShutdownManager.onUnhandled(err => {
      if (err && (err.message ?? '').includes('Cannot find module')) { // Handle module reloading
        console.error('Cannot find module', { error: err });
        return true;
      }
    }, 0);


    // Fire off, and let it run in the bg, restart on exit
    new CompilerClient().onFileChange(async ev => {
      if (ev.file && RootIndex.hasModule(ev.module) && VALID_FILE_TYPES.has(ManifestModuleUtil.getFileType(ev.file))) {
        await this.dispatch(ev);
      }
    }, true);
  }
}

export const DynamicFileLoader = new $DynamicFileLoader();