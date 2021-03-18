import * as sourceMapSupport from 'source-map-support';
import { EventEmitter } from 'events';

import { PathUtil, EnvUtil } from '@travetto/boot';
import { SourceIndex } from '@travetto/boot/src/internal/source';
import { ModuleManager } from '@travetto/boot/src/internal/module';
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
    this.rootFiles = new Set(SourceIndex.findByFolders(AppManifest.source, 'required').map(x => x.file));
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
      ModuleManager.setTranspiler(tsf => this.transpiler.transpile(tsf));
    }

    ModuleManager.onUnload((f, unlink) => this.transpiler.unload(f, unlink)); // Remove source

    // Update source map support to read from tranpsiler cache
    sourceMapSupport.install({
      retrieveFile: p => this.transpiler.getContents(PathUtil.toUnixTs(p))!
    });

    console.debug('Initialized', { duration: (Date.now() - start) / 1000 });
  }

  /**
   * Reset the compiler
   */
  reset() {
    if (!EnvUtil.isReadonly()) {
      this.transpiler.reset();
    }
    SourceIndex.reset();
    this.active = false;
  }

  /**
   * Notify of an add/remove/change event
   */
  notify(type: 'added' | 'removed' | 'changed', filename: string) {
    console.debug('File Event', { type, filename: filename.replace(PathUtil.cwd, '.') });
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
      ModuleManager.unload(filename);
    }
    // Load Synchronously
    require(filename);
    this.notify('added', filename);
  }

  /**
   * Handle when a file is removed during watch
   */
  removed(filename: string) {
    ModuleManager.unload(filename, true);
    this.notify('removed', filename);
  }

  /**
   * When a file changes during watch
   */
  changed(filename: string) {
    if (this.transpiler.hashChanged(filename)) {
      ModuleManager.unload(filename);
      // Load Synchronously
      require(filename);
      this.notify('changed', filename);
    }
  }
}

export const Compiler = new $Compiler();