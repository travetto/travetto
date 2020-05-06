import { Class } from '@travetto/registry';
import type { Compiler } from '@travetto/compiler/src/compiler';
import { ShutdownManager } from '@travetto/base';

import { FilePresenceManager } from '../presence';
import { RetargettingProxy } from '../proxy';
import { CompileUtil } from '@travetto/boot';

/**
 * Wraps the compiler supporting real-time changes to files
 */
export function CompilerAdaptor($Compiler: Class<typeof Compiler>) {
  /**
   * Extending the $Compiler class to add some functionality
   */
  const Cls = class extends $Compiler {
    presenceManager: FilePresenceManager;
    modules = new Map<string, RetargettingProxy<any>>();

    constructor(...args: any[]) {
      super(...args);

      this.presenceManager = new FilePresenceManager({
        ext: '.ts',
        cwd: this.cwd,
        excludeFiles: [/.*.d.ts$/, new RegExp(`${this.cwd}/index.ts`), /\/node_modules\//], // DO not look into node_modules, only user code
        rootPaths: this.rootPaths,
        listener: this as any,
        initialFileValidator: x => !(x.file in require.cache) // Skip already imported files
      });

      ShutdownManager.onUnhandled(err => {
        if (err && (err.message ?? '').includes('Cannot find module')) { // Handle module reloading
          console.error(err);
          return true;
        }
      }, 0);

      // Proxy all file loads
      CompileUtil.addModuleHandler((name, mod) => {
        if (name.includes(this.cwd) && !name.includes('node_modules')) {
          if (!this.modules.has(name)) {
            this.modules.set(name, new RetargettingProxy(mod));
          } else {
            this.modules.get(name)!.setTarget(mod);
          }
          return this.modules.get(name)!;
        } else {
          return mod;
        }
      });
    }

    init() {
      super.init();
      this.presenceManager.init();
    }

    reset() {
      super.reset();
      this.modules.clear();
      this.presenceManager.reset();
    }

    /**
     * Wrap compile, listening for new additions
     */
    compile(mod: NodeModule, tsf: string) {
      const isNew = !this.presenceManager.has(tsf);
      try {
        return super.compile(mod, tsf);
      } finally {
        // If known by the source manager, track it's presence
        //   some files will be transpile only, and should not trigger
        //   presence activity
        if (isNew && this.transpiler.hasContents(tsf)) {
          this.presenceManager.addNewFile(tsf, false);
        }
      }
    }
  };

  Object.defineProperty(Cls, 'name', { value: '$Compiler' });

  return Cls;
}