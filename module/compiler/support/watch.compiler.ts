import { ShutdownManager, ScanApp } from '@travetto/base';
import { FilePresenceManager, RetargettingProxy } from '@travetto/watch';
import { CompileUtil, FsUtil } from '@travetto/boot';

import { Compiler } from '../src/compiler';

/**
 * Wraps the compiler supporting real-time changes to files
 */
export function watch($Compiler: { new(...args: any[]): typeof Compiler }) {
  /**
   * Extending the $Compiler class to add some functionality
   */
  const Cls = class extends $Compiler {
    presenceManager: FilePresenceManager;
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
        if (name.includes(FsUtil.cwd) && !name.includes('node_modules') && /(src|test)\//.test(name)) {
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

      // Update sourcemap support
      require('source-map-support').install({
        retrieveFile: (p: string) => this.transpiler.getContents(p)
      });
    }

    init() {
      super.init();
      this.presenceManager = new FilePresenceManager({ // Kick off listener
        validFile: f =>
          !f.includes('node_modules') &&
          f.endsWith('.ts') &&
          !f.endsWith('.d.ts') &&
          f !== `${FsUtil.cwd}/index.ts`,
        cwd: FsUtil.cwd,
        files: ScanApp.findFiles({ rootPaths: this.appRoots, folder: 'src' })
          .filter(x => !(x.file in require.cache)) // Skip already imported files
          .map(x => x.file),
        folders: ScanApp.findFolders({ rootPaths: this.appRoots, folder: 'src' }),
        listener: this,
      });
    }

    reset() {
      super.reset();
      this.modules.clear();
      this.presenceManager.close();
    }

    /**
     * Wrap compile, listening for new additions
     */
    compile(mod: NodeModule, tsf: string) {
      const isNew = !this.presenceManager?.has(tsf);
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

  Object.defineProperty(Cls, 'name', { value: $Compiler.name });

  return Cls;
}