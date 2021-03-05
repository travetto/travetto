import { EventEmitter } from 'events';

import { FsUtil, EnvUtil } from '@travetto/boot';
import { SourceCodeIndex, CompileUtil } from '@travetto/boot/src/internal';
import { AppManifest } from '@travetto/base';
import { Watchable } from '@travetto/base/src/internal/watchable';

import { Transpiler } from './transpiler';

/**
 * Compilation orchestrator, interfaces with watching, unloading, emitting and delegates appropriately
 */
@Watchable('@travetto/compiler/support/watch.compiler')
class $Compiler {

  protected transpiler: Transpiler;
  protected emitter = new EventEmitter();
  protected rootFiles: Set<string>;

  active = false;

  constructor() {
    this.rootFiles = new Set(SourceCodeIndex.findByFolders(AppManifest.source, 'required').map(x => x.file));
    this.transpiler = new Transpiler(this.rootFiles);
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
  async init() {
    if (this.active) {
      return;
    }

    const start = Date.now();
    this.active = true;

    if (!EnvUtil.isReadonly()) {
      await this.transpiler.init();
      // Enhance transpilation, with custom transformations
      CompileUtil.setTranspiler(this.transpile.bind(this));
    }

    console.debug('Initialized', { duration: (Date.now() - start) / 1000 });
  }

  /**
   * Transpile a file
   */
  transpile(tsf: string) {
    return this.transpiler.transpile(tsf);
  }

  /**
   * Reset the compiler
   */
  reset() {
    if (!EnvUtil.isReadonly()) {
      this.transpiler.reset();
    }
    SourceCodeIndex.reset();
    this.active = false;
  }

  /**
   * Unload transpiled file
   */
  unload(filename: string, unlink = false) {
    this.transpiler.unload(filename, unlink); // Remove source
    return CompileUtil.unload(filename);
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
   * Unload if file is known
   */
  added(filename: string) {
    if (filename in require.cache) { // if already loaded
      this.unload(filename);
    }
    // Load Synchronously
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
    if (this.transpiler.hashChanged(filename)) {
      this.unload(filename);
      // Load Synchronously
      require(filename);
      this.notify('changed', filename);
    }
  }
}

export const Compiler = new $Compiler();