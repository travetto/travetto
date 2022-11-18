import { WatchUtil } from '@travetto/base';
import { RetargettingProxy } from '@travetto/base/src/internal/proxy';
import { ModuleIndex, ShutdownManager } from '@travetto/boot';

import type { ClassSource } from '../src/source/class-source';

const IS_VALID_SOURCE = (file: string): boolean => !file.includes('node_modules') && file.includes('src/');

/**
 * Wraps the class source supporting real-time changes to files
 */
class $DynamicClassSource {
  #modules = new Map<string, RetargettingProxy<unknown>>();

  async init(target: ClassSource): Promise<void> {
    const { DynamicLoader } = await import('@travetto/base/src/internal/dynamic-loader');

    const localMods = Object.values(ModuleIndex.manifest.modules).filter(x => x.local).map(x => ModuleIndex.getModule(x.name)!);
    const folders = localMods.map(x => x.output);

    ShutdownManager.onUnhandled(err => {
      if (err && (err.message ?? '').includes('Cannot find module')) { // Handle module reloading
        console.error('Cannot find module', { error: err });
        return true;
      }
    }, 0);


    // Proxy all file loads
    DynamicLoader.onLoad((name, mod) => {
      if (IS_VALID_SOURCE(name)) {
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

    // Clear target on unload
    DynamicLoader.onUnload(f => this.#modules.get(f)?.setTarget(null));

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
        case 'delete': return DynamicLoader.unload(file);
      }
    });
  }
}

export const DynamicClassSource = new $DynamicClassSource();