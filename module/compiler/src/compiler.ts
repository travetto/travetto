import * as fs from 'fs';

import { EventEmitter } from 'events';

import { FsUtil, AppCache, FileCache, RegisterUtil, TranspileUtil } from '@travetto/boot';
import { Env, ShutdownManager, FilePresenceManager, PresenceListener, ScanApp } from '@travetto/base';

import { Transpiler } from './transpiler';

/**
 * Compilation orchestrator
 */
class $Compiler extends EventEmitter {

  private transpiler: Transpiler;

  presenceManager: FilePresenceManager;
  active = false;

  constructor(
    /**
     * The working directory
     */
    private cwd: string = Env.cwd,
    /**
     * The cache source
     */
    private cache: FileCache = AppCache,
    /**
     * This of paths to compile against
     */
    private rootPaths: string[] = ScanApp.getAppPaths()
  ) {
    super();

    if (Env.watch) { // If watching, let unhandled imports not kill the program
      ShutdownManager.onUnhandled(err => {
        if (err && (err.message ?? '').includes('Cannot find module')) { // Handle module reloading
          console.error(err);
          return true;
        }
      }, 0);
    }

    this.transpiler = new Transpiler(this.cwd, this.cache, this.rootPaths);
    this.presenceManager = new FilePresenceManager({
      ext: '.ts',
      cwd: this.cwd,
      excludeFiles: [/.*.d.ts$/, new RegExp(`${this.cwd}/index.ts`), /\/node_modules\//], // DO not look into node_modules, only user code
      rootPaths: this.rootPaths,
      listener: this,
      initialFileValidator: x => !(x.file in require.cache) // Skip already imported files
    });
  }

  /**
   * Return list of root files captured by the compiler
   */
  getRootFiles() {
    return this.transpiler.getRootFiles();
  }

  /**
   * Initialize the compiler
   */
  init() {
    if (this.active) {
      return;
    }

    const start = Date.now();
    this.active = true;
    require.extensions[TranspileUtil.ext] = this.compile.bind(this);
    this.transpiler.init();
    this.presenceManager.init();

    console.debug('Initialized', (Date.now() - start) / 1000);
  }

  /**
   * Reset the compiler
   */
  reset() {
    this.transpiler.reset();
    this.presenceManager.reset();
    ScanApp.reset();
    this.active = false;
  }

  /**
   * Notify of an add/remove/change event
   */
  notify(type: keyof PresenceListener, fileName: string) {
    console.trace(`File ${type}`, fileName);
    this.emit(type, fileName);
  }

  /**
   * Remove file from require.cache, and possible the file system
   */
  unload(fileName: string, unlink = false) {
    this.transpiler.unload(fileName, unlink); // Remove source
    const native = FsUtil.toNative(fileName);
    if (native in require.cache) {
      delete require.cache[native]; // Remove require cached element
    }
  }

  /**
   * Handle when a file is removed during watch
   */
  removed(fileName: string) {
    this.unload(fileName, true);
    this.notify('removed', fileName);
  }

  /**
   * When a new file is added during watch
   */
  added(fileName: string) {
    if (this.presenceManager.isWatchedFileKnown(fileName)) {
      this.unload(fileName);
    }
    require(fileName);
    this.notify('added', fileName);
  }

  /**
   * When a file changes during watch
   */
  changed(fileName: string) {
    if (this.transpiler.hashChanged(fileName, fs.readFileSync(fileName, 'utf-8'))) {
      this.unload(fileName);
      require(fileName);
      this.notify('changed', fileName);
    }
  }

  /**
   * Compile a file, follows the same shape as `Module._compile`
   */
  compile(m: NodeModule, tsf: string) {
    const isNew = !this.presenceManager.has(tsf);
    try {
      return RegisterUtil.doCompile(m, this.transpiler.getTranspiled(tsf), tsf);
    } finally {
      // If known by the source manager, track it's presence
      //   some files will be transpile only, and should not trigger
      //   presence activity
      if (isNew && this.transpiler.hasContents(tsf)) {
        this.presenceManager.addNewFile(tsf, false);
      }
    }
  }
}

export const Compiler = new $Compiler();