import { EventEmitter } from 'events';

import { AppInfo, Env, FsUtil } from '@travetto/base';

import { TransformerManager } from './transformers';
import { CompilerUtil } from './util';
import { SourceManager } from './source';
import { ModuleManager } from './module';
import { FilePresenceManager } from './presence';

type WatchEvent = 'required-after' | 'added' | 'changed' | 'removed';

class $Compiler {

  moduleManager: ModuleManager;
  sourceManager: SourceManager;
  presenceManager: FilePresenceManager;
  transformerManager: TransformerManager;
  active = false;

  // Event manager
  events = new EventEmitter();

  constructor(public cwd: string) {

    const exclude = [/\.d\.ts$/]; // Definition files

    // Get Files proper like
    if (AppInfo.DEV_PACKAGES && AppInfo.DEV_PACKAGES.length) {
      exclude.push(new RegExp(`${CompilerUtil.LIBRARY_PATH}[\/](${AppInfo.DEV_PACKAGES.join('|')})[\/]`));
    }

    this.transformerManager = new TransformerManager(this.cwd);
    this.moduleManager = new ModuleManager(this.cwd);
    this.sourceManager = new SourceManager(this.cwd, {});
    this.presenceManager = new FilePresenceManager(this.cwd, {
      added: (name: string) => {
        if (this.transpile(name)) {
          this.events.emit('added', name);
        }
      },
      changed: (name: string) => {
        if (this.transpile(name, true)) {
          this.events.emit('changed', name);
        }
      },
      removed: (name: string) => {
        this.unload(name);
        this.events.emit('removed', name);
      }
    }, exclude);
  }

  init() {
    if (this.active) {
      return;
    }

    this.active = true;
    this.sourceManager.registerSourceMaps();
    this.transformerManager.init();
    require.extensions['.ts'] = this.requireHandler.bind(this);
    this.moduleManager.init();

    const start = Date.now();
    this.presenceManager.init();
    console.debug('Initialized', (Date.now() - start) / 1000);
  }

  reset() {
    this.sourceManager.clear();
    this.moduleManager.clear();
    this.presenceManager.reset();

    this.active = false;

    this.init();
  }

  requireHandler(m: NodeModule, tsf: string) {
    const jsf = tsf.replace(/\.ts$/, '.js');

    const isNew = !this.sourceManager.has(tsf);

    if (isNew) {
      this.presenceManager.addNewFile(tsf);
    }

    // Log transpiled content as needed
    const content = this.sourceManager.get(tsf)!;

    if (Env.trace && !tsf.includes(CompilerUtil.LIBRARY_PATH)) {
      console.trace(content);
    }

    try {
      const ret = this.moduleManager.compile(m, jsf, content);
      if (ret) {
        if (isNew) {
          this.events.emit('required-after', tsf);
        }
      } else {
        this.sourceManager.set(tsf, CompilerUtil.EMPTY_MODULE);
      }
      return ret;
    } catch (e) {
      if (e.message.startsWith('Cannot find module') || e.message.startsWith('Unable to load')) {
        const name = m.filename.replace(`${this.cwd}/`, '');
        const err = new Error(`${e.message} ${e.message.includes('from') ? `[via ${name}]` : `from ${name}`}`);
        err.stack = err.stack;
        throw err;
      } else {
        throw e;
      }
    }
  }

  markForReload(files: string[] | string) {
    if (!Array.isArray(files)) {
      files = [files];
    }
    for (const fileName of files) {
      this.unload(fileName);
      // Do not automatically reload
    }
  }

  unload(fileName: string, unlink = true) {
    console.trace('Unloading', fileName);

    if (this.sourceManager.has(fileName)) {
      this.sourceManager.unload(fileName, unlink);
    }

    const native = FsUtil.toNative(fileName);
    if (native in require.cache) {
      delete require.cache[native];
    }

    this.moduleManager.unload(fileName);
  }

  transpile(fileName: string, force = false) {
    const changed = this.sourceManager.transpile(fileName, {
      fileName,
      reportDiagnostics: true,
      transformers: this.transformerManager.transformers || {}
    }, force);

    if (changed && (force || this.presenceManager.isWatchedFileLoaded(fileName))) {
      // If file is already loaded, mark for reload
      this.markForReload(fileName);
    }

    return changed;
  }

  on(event: WatchEvent, callback: (filename: string) => any) {
    this.events.addListener(event, callback);
  }

  off(event: WatchEvent, callback: (filename: string) => any) {
    this.events.removeListener(event, callback);
  }
}

export const Compiler = new $Compiler(Env.cwd);