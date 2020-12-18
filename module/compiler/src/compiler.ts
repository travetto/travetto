import { EventEmitter } from 'events';
import * as fs from 'fs';

import { FsUtil, AppCache, FileCache, CompileUtil, TranspileUtil, EnvUtil } from '@travetto/boot';
import { ScanApp, AppManifest } from '@travetto/base';
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
    /**
     * This of paths to compile against
     */
    protected readonly roots: string[] = AppManifest.roots
  ) {
    this.rootFiles = new Set(ScanApp.findAppSourceFiles({ roots: this.roots }).map(x => x.file));
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

    require.extensions[TranspileUtil.ext] = this.compile.bind(this);

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
  unload(fileName: string, unlink = false) {
    this.transpiler.unload(fileName, unlink); // Remove source
    const native = FsUtil.toNative(fileName);
    if (native in require.cache) {
      delete require.cache[native]; // Remove require cached element
      return true;
    }
  }

  /**
   * Notify of an add/remove/change event
   */
  notify(type: 'added' | 'removed' | 'changed', fileName: string) {
    console.debug('File Event', { type, fileName: fileName.replace(FsUtil.cwd, '.') });
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
    const content = this.transpile(tsf)
      .replace(new RegExp(`(require.*)(${'@'}${'app'})`, 'mg'), (all, pre) => `${pre}${FsUtil.cwd}`);
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