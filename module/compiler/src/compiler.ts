import { EventEmitter } from 'events';
import * as fs from 'fs';

import { FsUtil, AppCache, FileCache, CompileUtil, TranspileUtil } from '@travetto/boot';
import { Env, ScanApp } from '@travetto/base';

import { Transpiler } from './transpiler';

/**
 * Compilation orchestrator
 */
class $Compiler extends EventEmitter {

  protected transpiler: Transpiler;

  active = false;

  constructor(
    /**
     * The working directory
     */
    protected readonly cwd: string = Env.cwd,
    /**
     * The cache source
     */
    protected cache: FileCache = AppCache,
    /**
     * This of paths to compile against
     */
    protected readonly rootPaths: string[] = ScanApp.getAppPaths()
  ) {
    super();

    this.transpiler = new Transpiler(this.cwd, this.cache, this.rootPaths);
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
    console.debug('Initialized', (Date.now() - start) / 1000);
  }

  /**
   * Reset the compiler
   */
  reset() {
    this.transpiler.reset();
    ScanApp.reset();
    this.active = false;
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
   * Notify of an add/remove/change event
   */
  notify(type: 'added' | 'removed' | 'changed', fileName: string) {
    console.trace(`File ${type}`, fileName);
    this.emit(type, fileName);
  }

  /**
   * Compile a file, follows the same shape as `Module._compile`
   */
  compile(m: NodeModule, tsf: string) {
    return CompileUtil.doCompile(m, this.transpiler.getTranspiled(tsf), tsf);
  }

  /**
   * Unload if file is known
   */
  added(fileName: string) {
    if (fileName in require.cache) { // if already loaded
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
}

export const Compiler = new /* @inline:watch */$Compiler/* @end */();