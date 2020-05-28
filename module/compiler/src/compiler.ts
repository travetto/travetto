import { EventEmitter } from 'events';
import * as fs from 'fs';

import { FsUtil, AppCache, FileCache, CompileUtil, TranspileUtil } from '@travetto/boot';
import { ScanApp, Env } from '@travetto/base';
import { Watchable } from '@travetto/base/src/internal/watchable';

import { Transpiler } from './transpiler';

/**
 * Compilation orchestrator
 */
@Watchable('@travetto/compiler/support/watch.compiler')
class $Compiler {

  protected transpiler: Transpiler;
  protected emitter = new EventEmitter();

  active = false;

  constructor(
    /**
     * The cache source
     */
    protected cache: FileCache = AppCache,
    /**
     * This of paths to compile against
     */
    protected readonly appRoots: string[] = Env.appRoots
  ) {
    this.transpiler = new Transpiler(this.cache, this.appRoots);
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
    console.debug(`File ${type}`, fileName);
    this.emitter.emit(type, fileName);
  }

  /**
   * Listen for events
   */
  on<T extends 'added' | 'removed' | 'changed'>(type: T, handler: (filename: string) => void) {
    this.emitter.on(type, handler);
  }

  /**
   * Compile a file, follows the same shape as `Module._compile`
   */
  compile(m: NodeModule, tsf: string) {
    return CompileUtil.compileJavascript(m, this.transpile(tsf), tsf);
  }

  /**
   * Transpile a given file
   * @param tsf The typescript file to transpile
   */
  transpile(tsf: string) {
    return this.transpiler.transpile(tsf);
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

export const Compiler = new $Compiler();