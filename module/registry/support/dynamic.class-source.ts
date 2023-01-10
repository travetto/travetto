import { ObjectUtil, RetargettingProxy, ShutdownManager, WatchUtil } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';

import type { DynamicLoader } from '@travetto/base/src/internal/dynamic-loader.js';

import type { ClassSource } from '../src/source/class-source';

type ManualWatchEvent = { type: 'trigger-watch', action: 'create' | 'update' | 'delete' | 'eager-load', file: string };

function isEvent(ev: unknown): ev is ManualWatchEvent {
  return ObjectUtil.isPlainObject(ev) &&
    'type' in ev && typeof ev.type === 'string' && ev.type === 'trigger-watch' &&
    'action' in ev && 'file' in ev;
}

/**
 * Wraps the class source supporting real-time changes to files
 */
class $DynamicClassSource {
  #modules = new Map<string, RetargettingProxy<unknown>>();
  #target: ClassSource;
  #loader: typeof DynamicLoader;

  #setMod(file: string, mod?: unknown): unknown {
    if (!this.#modules.has(file)) {
      this.#modules.set(file, new RetargettingProxy(mod));
    } else {
      this.#modules.get(file)!.setTarget(mod);
    }
    return this.#modules.get(file)!.get();
  }

  async onEvent(action: ManualWatchEvent['action'], file: string): Promise<void> {
    switch (action) {
      case 'create': {
        await this.#loader.load(file);
        return this.#target.processFiles(true);
      }
      case 'update': {
        await this.#loader.reload(file);
        return this.#target.processFiles();
      }
      case 'delete': {
        this.#setMod(file, null);
        await this.#loader.unload(file);
        return;
      }
      case 'eager-load': {
        if (!this.#loader.isLoaded(file)) {
          await this.onEvent('create', file);
        }
      }
    }
  }

  async init(target: ClassSource): Promise<void> {
    const res = await import('@travetto/base/src/internal/dynamic-loader.js');
    this.#loader = res.DynamicLoader;
    this.#target = target;

    const localMods = RootIndex.getLocalModules();
    const folders = localMods.map(x => x.output);

    ShutdownManager.onUnhandled(err => {
      if (err && (err.message ?? '').includes('Cannot find module')) { // Handle module reloading
        console.error('Cannot find module', { error: err });
        return true;
      }
    }, 0);

    // Proxy all file loads
    this.#loader.onLoad((name, mod) =>
      RootIndex.getModuleFromSource(name)?.local ? this.#setMod(name, mod) : mod);

    this.#loader.init();

    process.on('message', async ev => {
      if (isEvent(ev)) {
        const found = RootIndex.getFromSource(ev.file);
        if (found) {
          this.onEvent(ev.action, found.import);
        }
      }
    });


    await WatchUtil.buildWatcher(folders, ev => this.onEvent(ev.type, ev.path), ev => ev.path.endsWith('.js'));
  }
}

export const DynamicClassSource = new $DynamicClassSource();