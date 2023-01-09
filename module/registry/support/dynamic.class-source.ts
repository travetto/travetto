import { RetargettingProxy, ShutdownManager, WatchUtil } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';

import type { ClassSource } from '../src/source/class-source';

/**
 * Wraps the class source supporting real-time changes to files
 */
class $DynamicClassSource {
  #modules = new Map<string, RetargettingProxy<unknown>>();

  #setMod(file: string, mod?: unknown): unknown {
    if (!this.#modules.has(file)) {
      this.#modules.set(file, new RetargettingProxy(mod));
    } else {
      this.#modules.get(file)!.setTarget(mod);
    }
    return this.#modules.get(file)!.get();
  }

  async init(target: ClassSource): Promise<void> {
    const { DynamicLoader } = await import('@travetto/base/src/internal/dynamic-loader.js');

    const localMods = RootIndex.getLocalModules();
    const folders = localMods.map(x => x.output);

    ShutdownManager.onUnhandled(err => {
      if (err && (err.message ?? '').includes('Cannot find module')) { // Handle module reloading
        console.error('Cannot find module', { error: err });
        return true;
      }
    }, 0);

    // Proxy all file loads
    DynamicLoader.onLoad((name, mod) =>
      RootIndex.getModuleFromSource(name)?.local ? this.#setMod(name, mod) : mod);

    DynamicLoader.init();

    await WatchUtil.buildWatcher(folders, async ({ type, path: file }) => {
      switch (type) {
        case 'create': {
          await DynamicLoader.load(file);
          return target.processFiles(true);
        }
        case 'update': {
          await DynamicLoader.reload(file);
          return target.processFiles();
        }
        case 'delete': {
          this.#setMod(file, null);
          await DynamicLoader.unload(file);
        }
      }
    }, ({ path }) => path.endsWith('.js'));
  }
}

export const DynamicClassSource = new $DynamicClassSource();