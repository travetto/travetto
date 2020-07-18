import { ShutdownManager } from '@travetto/base';
import { FilePresenceManager, RetargettingProxy } from '@travetto/watch';
import { CompileUtil, FsUtil } from '@travetto/boot';
import type { Class } from '@travetto/registry';

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
    modules = new Map<string, RetargettingProxy<any>>();

    constructor(...args: any[]) {
      super(...args);

      ShutdownManager.onUnhandled(err => {
        if (err && (err.message ?? '').includes('Cannot find module')) { // Handle module reloading
          console.error(err);
          return true;
        }
      }, 0);

      // Proxy all file loads
      CompileUtil.addModuleHandler((name, mod) => {
        if (name.includes(FsUtil.cwd) && !name.includes('node_modules') && /src\//.test(name)) {
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

      // Update source map support
      require('source-map-support').install({
        retrieveFile: (p: string) => this.transpiler.getContents(p)
      });

      this.presence = new FilePresenceManager(this.roots.flatMap(x => x === '.' ? [`${x}/src`, `${x}/test`] : [`${x}/src`]), {
        ignoreInitial: true,
        validFile: x => x.endsWith('.ts') && !x.endsWith('.d.ts')
      }).on('all', ({ event, entry }) => {
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