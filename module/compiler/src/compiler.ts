import { EventEmitter } from 'events';
import * as sourceMapSupport from 'source-map-support';
import * as ts from 'typescript';

import { PathUtil, EnvUtil, AppCache } from '@travetto/boot';
import { SourceIndex } from '@travetto/boot/src/internal/source';
import { ModuleManager } from '@travetto/boot/src/internal/module';
import { Dynamic } from '@travetto/base/src/internal/dynamic';
import { TranspileUtil } from '@travetto/boot/src/internal/transpile-util';

import { SourceHost } from './host';
import { TransformerManager } from './transformer';

type FileListener = (name: string) => void;
type EventType = 'added' | 'removed' | 'changed';

/**
 * Compilation orchestrator, interfaces with watching, unloading, emitting and delegates appropriately
 */
@Dynamic('@travetto/compiler/support/dynamic.compiler')
class $Compiler {

  #program: ts.Program | undefined;
  #transformerManager = new TransformerManager();
  #emitter = new EventEmitter();
  #host = new SourceHost();

  active = false;

  /**
   * Build typescript program
   *
   * @param forFile If this file is new, force a recompilation
   */
  #getProgram(forFile?: string): ts.Program {

    const rootFiles = this.#host.getRootFiles();

    if (!this.#program || (forFile && !rootFiles.has(forFile))) {
      console.debug('Loading program', { size: rootFiles.size, src: forFile });
      if (forFile) {
        rootFiles.add(forFile);
      }
      this.#program = ts.createProgram({
        rootNames: [...rootFiles],
        options: TranspileUtil.compilerOptions as ts.CompilerOptions,
        host: this.#host,
        oldProgram: this.#program
      });
      this.#transformerManager.build(this.#program.getTypeChecker());
    }
    return this.#program;
  }

  /**
   * Perform actual transpilation
   */
  #transpile(filename: string, force = false) {
    if (force || !AppCache.hasEntry(filename)) {
      console.debug('Emitting', { filename: filename.replace(PathUtil.cwd, '.') });

      try {
        const prog = this.#getProgram(filename);

        const result = prog.emit(
          prog.getSourceFile(filename),
          undefined,
          undefined,
          false,
          this.#transformerManager.getTransformers()
        );

        TranspileUtil.checkTranspileErrors(filename, result.diagnostics as []);
      } catch (err) {
        const errContent = TranspileUtil.transpileError(filename, err);
        this.#host.contents.set(filename, errContent);
      }
      // Save writing for typescript program (`writeFile`)
    } else {
      this.#host.fetchFile(filename);
    }

    return this.#host.contents.get(filename)!;
  }

  /**
   * Get program
   * @private
   */
  getProgram() {
    return this.#getProgram();
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
      await this.#transformerManager.init();
      // Enhance transpilation, with custom transformations
      ModuleManager.setTranspiler(tsf => this.#transpile(tsf));
    }

    ModuleManager.onUnload((f, unlink) => this.#host.unload(f, unlink)); // Remove source

    // Update source map support to read from tranpsiler cache
    sourceMapSupport.install({
      retrieveFile: p => this.#host.contents.get(PathUtil.toUnixTs(p))!
    });

    console.debug('Initialized', { duration: (Date.now() - start) / 1000 });
  }

  /**
   * Reset the compiler
   */
  reset() {
    if (!EnvUtil.isReadonly()) {
      this.#transformerManager.reset();
      this.#host.reset();
      this.#program = undefined;
    }
    ModuleManager.clearUnloadHandlers();
    SourceIndex.reset();
    this.active = false;
  }

  /**
   * Notify of an add/remove/change event
   */
  notify(type: EventType, filename: string) {
    console.debug('File Event', { type, filename: filename.replace(PathUtil.cwd, '.') });
    this.#emitter.emit(type, filename);
  }

  /**
   * Listen for events
   */
  on(type: EventType, handler: FileListener) {
    this.#emitter.on(type, handler);
    return this;
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
    if (this.#host.hashChanged(filename)) {
      ModuleManager.unload(filename);
      // Load Synchronously
      require(filename);
      this.notify('changed', filename);
    }
  }
}

export const Compiler = new $Compiler();