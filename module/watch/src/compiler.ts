import * as fs from 'fs';

import type { Compiler } from '@travetto/compiler/src/compiler';
import { ShutdownManager } from '@travetto/base';

import { FilePresenceManager } from './presence';

/**
 * Wraps the compiler supporting real-time changes to files
 */
export function CompilerAdaptor($Compiler: { new(...args: any[]): typeof Compiler }) {

  /**
   * Extending the $Compiler class to add some functionality
   */
  const Cls = class extends $Compiler {
    presenceManager: FilePresenceManager;

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
    }

    init() {
      super.init();
      this.presenceManager.init();
    }

    reset() {
      super.reset();
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

    /**
     * Unload if file is known
     */
    added(fileName: string) {
      if (this.presenceManager.isKnown(fileName)) {
        this.unload(fileName);
      }
      require(fileName);
      this.notify('added', fileName);
    }

    /**
     * Handle when a file is removed during watch
     */
    removed(fileName: string) {
      this.unload(fileName, true);
      this.notify('removed', fileName);
    }

    /**
     * When a file changes during watch
     */
    changed(fileName: string) {
      if (this.transpiler.hashChanged(fileName, fs.readFileSync(fileName, 'utf8'))) {
        this.unload(fileName);
        require(fileName);
        this.notify('changed', fileName);
      }
    }
  };

  Object.defineProperty(Cls, 'name', { value: '$Compiler' });

  return Cls;
}