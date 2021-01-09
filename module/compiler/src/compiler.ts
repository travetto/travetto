import { EventEmitter } from 'events';
import * as fs from 'fs';

import { FsUtil, AppCache, FileCache, CompileUtil, TranspileUtil, EnvUtil } from '@travetto/boot';
import { ScanApp } from '@travetto/base';
import { Watchable } from '@travetto/base/src/internal/watchable';

import { Transpiler } from './transpiler';

/**
 * Compilation orchestrator
 */
@Watchable('@trv:compiler/compiler')
class $Compiler {

  protected transpiler: Transpiler;
  protected emitter = new EventEmitter();
  protected rootFiles: Set<string>;

  active = false;

  constructor(
    /**
     * The cache source
     */
    protected cache: FileCache = AppCache,
  ) {
    this.rootFiles = new Set(ScanApp.findAllSourceFiles().map(x => x.file));
    this.transpiler = new Transpiler(this.cache, this.rootFiles);
  }

  /**
   * Return list of root files captured by the compiler
   */
  getRootFiles() {
    return this.rootFiles;
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

    require.extensions[TranspileUtil.EXT] = this.compile.bind(this);

    if (!EnvUtil.isReadonly()) {
      this.transpiler.init();
    } else { // Force reading from cache
      this.transpile = (tsf: string) => this.cache.readEntry(tsf);
    }

    console.debug('Initialized', { duration: (Date.now() - start) / 1000 });
  }

  /**
   * Reset the compiler
   */
  reset() {
    if (!EnvUtil.isReadonly()) {
      this.transpiler.reset();
    }
    ScanApp.reset();
    this.active = false;
  }

  /**
   * Remove file from require.cache, and possible the file system
   */
  unload(filename: string, unlink = false) {
    this.transpiler.unload(filename, unlink); // Remove source
    const native = FsUtil.toNative(filename);
    if (native in require.cache) {
      delete require.cache[native]; // Remove require cached element
      return true;
    }
  }

  /**
   * Notify of an add/remove/change event
   */
  notify(type: 'added' | 'removed' | 'changed', filename: string) {
    console.debug('File Event', { type, filename: filename.replace(FsUtil.cwd, '.') });
    this.emitter.emit(type, filename);
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
    const content = this.transpile(tsf);
    return CompileUtil.compileJavascript(m, content, tsf);
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
  added(filename: string) {
    if (filename in require.cache) { // if already loaded
      this.unload(filename);
    }
    require(filename);
    this.notify('added', filename);
  }

  /**
   * Handle when a file is removed during watch
   */
  removed(filename: string) {
    this.unload(filename, true);
    this.notify('removed', filename);
  }

  /**
   * When a file changes during watch
   */
  changed(filename: string) {
    if (this.transpiler.hashChanged(filename, fs.readFileSync(filename, 'utf8'))) {
      this.unload(filename);
      require(filename);
      this.notify('changed', filename);
    }
  }
}

export const Compiler = new $Compiler();