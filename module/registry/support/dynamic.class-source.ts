import { path } from '@travetto/common';
import { ShutdownManager } from '@travetto/base';
import { RetargettingProxy, ModuleIndex } from '@travetto/boot';

import type { ClassSource } from '../src/source/class-source';

const IS_VALID_SOURCE = (file: string): boolean => !file.includes('node_modules') && file.includes('src/');

/**
 * Wraps the class source supporting real-time changes to files
 */
class $DynamicClassSource {
  #modules = new Map<string, RetargettingProxy<unknown>>();

  async init(target: ClassSource) {
    const { DynamicLoader } = await import('@travetto/boot/src/internal/dynamic-loader');
    const { FilePresenceManager } = await import('@travetto/watch');

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

    const folders = ModuleIndex.findOwnSrc()
      .reduce((acc, v) => {
        let d = path.dirname(v.output);
        do {
          acc.add(d);
          d = path.dirname(d);
        } while (!d.endsWith('/src'));
        return acc;
      }, new Set<string>());

    new FilePresenceManager([...folders], { ignoreInitial: true, validFile: f => f.endsWith('.js') })
      .on('added', async ({ file }) => {
        await DynamicLoader.load(file);
        target.processFiles(true);
      })
      .on('changed', async ({ file }) => {
        await DynamicLoader.reload(file);
        target.processFiles();
      })
      .on('removed', async ({ file }) => DynamicLoader.unload(file));
  }
}

export const DynamicClassSource = new $DynamicClassSource();