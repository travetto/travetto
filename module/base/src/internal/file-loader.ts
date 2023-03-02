import timers from 'timers/promises';

import { ManifestModuleUtil, RootIndex, WatchEvent, watchFolders } from '@travetto/manifest';

import { ObjectUtil } from '../object';
import { ShutdownManager } from '../shutdown';

type WatchHandler = (ev: WatchEvent) => (void | Promise<void>);
type ManualWatchEvent = { trigger?: boolean } & WatchEvent;
interface ModuleLoader {
  init?(): Promise<void>;
  load(file: string): Promise<void>;
  unload(file: string): Promise<void>;
}

function isTriggerEvent(ev: unknown): ev is ManualWatchEvent {
  return ObjectUtil.isPlainObject(ev) &&
    ('action' in ev && typeof ev.action === 'string') &&
    ('file' in ev && typeof ev.file === 'string') &&
    ('trigger' in ev && typeof ev.trigger === 'boolean');
}

/**
 * Listens to file changes, and provides a unified interface for watching file changes, reloading files as needed
 */
class $DynamicFileLoader {
  #handlers: WatchHandler[] = [];
  #loader: ModuleLoader;
  #initialized = false;

  async dispatch(ev: WatchEvent, folder: string): Promise<void> {
    if (ev.action !== 'create') {
      await this.#loader.unload(ev.file);
    } else {
      RootIndex.reinitForModule(RootIndex.mainModule.name);
    }
    if (ev.action !== 'delete') {
      await timers.setTimeout(100);
      await this.#loader.load(ev.file);
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

    process.on('message', async ev => {
      if (isTriggerEvent(ev)) {
        const found = RootIndex.getFromSource(ev.file);
        if (found) {
          this.dispatch({ action: ev.action, file: found.outputFile }, RootIndex.getModule(found.module)!.sourceFolder);
        }
      }
    });

    ShutdownManager.onUnhandled(err => {
      if (err && (err.message ?? '').includes('Cannot find module')) { // Handle module reloading
        console.error('Cannot find module', { error: err });
        return true;
      }
    }, 0);

    // Watch local output
    await watchFolders(
      RootIndex.getLocalModules().map(x => x.outputPath),
      (ev, folder) => this.dispatch(ev, folder),
      {
        filter: ev => ManifestModuleUtil.getFileType(ev.file) === 'js',
        createMissing: true
      }
    );
  }
}

export const DynamicFileLoader = new $DynamicFileLoader();