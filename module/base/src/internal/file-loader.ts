import { ManifestModuleUtil, RootIndex } from '@travetto/manifest';

import { ExecUtil } from '../exec';
import { ObjectUtil } from '../object';
import { ShutdownManager } from '../shutdown';
import { CompilerWatchEvent, listenFileChanges } from './compiler-client';

type WatchHandler = (ev: CompilerWatchEvent) => (void | Promise<void>);
type ManualWatchEvent = { trigger?: boolean } & CompilerWatchEvent;
interface ModuleLoader {
  init?(): Promise<void>;
  load(file: string): Promise<void>;
  unload(file: string): Promise<void>;
}

const VALID_FILE_TYPES = new Set(['js', 'ts']);

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

    process.on('message', async ev => {
      if (isTriggerEvent(ev)) {
        if (ev.action === 'create') {
          // Load new content
          RootIndex.reinitForModule(RootIndex.mainModuleName);
        }
        const found = RootIndex.getFromSource(ev.file);
        if (found) {
          this.dispatch({
            action: ev.action, file: found.sourceFile, output: found.outputFile,
            folder: RootIndex.getModule(found.module)!.sourceFolder,
            module: found.module,
            time: Date.now()
          });
        }
      }
    });

    ShutdownManager.onUnhandled(err => {
      if (err && (err.message ?? '').includes('Cannot find module')) { // Handle module reloading
        console.error('Cannot find module', { error: err });
        return true;
      }
    }, 0);


    // Fire off, and let it run in the bg
    this.#listen();
  }

  async #listen(): Promise<void> {
    for await (const ev of listenFileChanges()) {
      if (ev.file && RootIndex.hasModule(ev.module) && VALID_FILE_TYPES.has(ManifestModuleUtil.getFileType(ev.file))) {
        await this.dispatch(ev);
      }
    }

    // We are done, request restart
    process.exit(ExecUtil.RESTART_EXIT_CODE);
  }
}

export const DynamicFileLoader = new $DynamicFileLoader();