import { WatchUtil } from '@travetto/base';
import { RetargettingProxy } from '@travetto/base/src/internal/proxy';
import { ModuleIndex, ShutdownManager } from '@travetto/boot';

import type { ClassSource } from '../src/source/class-source';

/**
 * Wraps the class source supporting real-time changes to files
 */
class $DynamicClassSource {
  #modules = new Map<string, RetargettingProxy<unknown>>();

  async init(target: ClassSource): Promise<void> {
    const { DynamicLoader } = await import('@travetto/base/src/internal/dynamic-loader.js');

    const localMods = ModuleIndex.getLocalModules();
    const folders = localMods.map(x => x.output);

    ShutdownManager.onUnhandled(err => {
      if (err && (err.message ?? '').includes('Cannot find module')) { // Handle module reloading
        console.error('Cannot find module', { error: err });
        return true;
      }
    }, 0);


    // Proxy all file loads
    DynamicLoader.onLoad((name, mod) => {
      if (ModuleIndex.getModuleFromSource(name)?.local) {
        if (!this.#modules.has(name)) {
          this.#modules.set(name, new RetargettingProxy(mod));
        } else {
          this.#modules.get(name)!.setTarget(mod);
        }
        return this.#modules.get(name)!.get();
      } else {
        return mod;
      }
    });

    DynamicLoader.init();

    console.debug('Watching for', folders);

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
          this.#modules.get(file)?.setTarget(null);
          await DynamicLoader.unload(file);
        }
      }
    });
  }
}

export const DynamicClassSource = new $DynamicClassSource();