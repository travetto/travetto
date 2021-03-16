import { AppManifest, Class, ShutdownManager } from '@travetto/base';
import { FilePresenceManager, RetargettingProxy } from '@travetto/watch';
import { FsUtil, PathUtil } from '@travetto/boot';
import { ModuleUtil } from '@travetto/boot/src/internal/module-util';

import { Compiler } from '../src/compiler';

/**
 * Wraps the compiler supporting real-time changes to files
 */
export function watch($Compiler: Class<typeof Compiler>) {
  /**
   * Extending the $Compiler class to add some functionality
   */
  const Cls = class extends $Compiler {
    presence: FilePresenceManager;
    modules = new Map<string, RetargettingProxy<unknown>>();

    constructor(...args: unknown[]) {
      super(...args);

      ShutdownManager.onUnhandled(err => {
        if (err && (err.message ?? '').includes('Cannot find module')) { // Handle module reloading
          console.error('Cannot find module', { error: err });
          return true;
        }
      }, 0);

      // Proxy all file loads
      ModuleUtil.addHandler((name, mod) => {
        if (name.includes(PathUtil.cwd) && !name.includes('node_modules') && /src\//.test(name)) {
          if (!this.modules.has(name)) {
            this.modules.set(name, new RetargettingProxy(mod));
          } else {
            this.modules.get(name)!.setTarget(mod);
          }
          return this.modules.get(name)!.get();
        } else {
          return mod;
        }
      });

      this.presence = new FilePresenceManager(
        [...AppManifest.source.local, ...AppManifest.source.common]
          .map(x => `./${x}`)
          .filter(x => FsUtil.existsSync(x)),
        {
          ignoreInitial: true,
          validFile: x => x.endsWith('.ts') && !x.endsWith('.d.ts')
        }
      ).on('all', ({ event, entry }) => {
        switch (event) {
          case 'added': this.added(entry.file); break;
          case 'removed': this.removed(entry.file); break;
          case 'changed': this.changed(entry.file); break;
        }
      });
    }

    reset() {
      super.reset();
      this.modules.clear();
    }
  };

  Object.defineProperty(Cls, 'name', { value: $Compiler.name });

  return Cls;
}