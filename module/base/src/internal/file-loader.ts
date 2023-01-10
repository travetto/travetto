import { RootIndex } from '@travetto/manifest';

import { ObjectUtil } from '../object';
import { FileWatchEvent, WatchUtil } from '../watch';
import { ShutdownManager } from '../shutdown';

type WatchHandler = (ev: FileWatchEvent) => (void | Promise<void>);
type ManualWatchEvent = { type: 'trigger-watch' } & FileWatchEvent;
interface ModuleLoader {
  init?(): Promise<void>;
  load(file: string): Promise<void>;
  unload(file: string): Promise<void>;
}

function isEvent(ev: unknown): ev is ManualWatchEvent {
  return ObjectUtil.isPlainObject(ev) &&
    'type' in ev && typeof ev.type === 'string' && ev.type === 'trigger-watch' &&
    'action' in ev && 'file' in ev;
}

/**
 * Listens to file changes, and provides a unified interface for watching file changes, reloading files as needed
 */
class $DynamicFileLoader {
  #handlers: WatchHandler[] = [];
  #loader: ModuleLoader;
  #initialized = false;

  async dispatch(ev: FileWatchEvent): Promise<void> {
    if (ev.action !== 'create') {
      await this.#loader.unload(ev.file);
    }
    if (ev.action !== 'delete') {
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
      if (isEvent(ev)) {
        const found = RootIndex.getFromSource(ev.file);
        if (found) {
          this.dispatch({ action: ev.action, file: found.output });
        }
      }
    });

    ShutdownManager.onUnhandled(err => {
      if (err && (err.message ?? '').includes('Cannot find module')) { // Handle module reloading
        console.error('Cannot find module', { error: err });
        return true;
      }
    }, 0);

    await WatchUtil.buildOutputWatcher(ev => this.dispatch(ev));
  }
}

export const DynamicFileLoader = new $DynamicFileLoader();