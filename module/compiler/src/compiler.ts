import { EventEmitter } from 'events';

import { FsUtil, AppCache } from '@travetto/boot';
import { Env, ScanApp } from '@travetto/base';

import { TransformerManager } from './transformer/manager';
import { SourceManager } from './source';
import { ModuleManager } from './module';
import { FilePresenceManager } from './presence';
import { CompilerUtil } from './util';

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

    // Get Files proper like
    this.transformerManager = new TransformerManager(this.cwd);
    this.moduleManager = new ModuleManager(this.cwd);
    this.sourceManager = new SourceManager(this.cwd, {});
    this.presenceManager = new FilePresenceManager(this.cwd, [...Env.appRoots],
      {
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
      });
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
      this.presenceManager.addNewFile(tsf); // Will transpile
    }

    // Log transpiled content as needed
    const content = this.sourceManager.get(tsf)!;
    try {
      const res = this.moduleManager.compile(m, jsf, content);
      if (isNew) {
        this.events.emit('required-after', tsf);
      }
      return res;
    } catch (e) {
      const file = tsf.replace(`${Env.cwd}/`, '');
      if (tsf.includes('/extension/')) { // If errored out on extension loading
        console.debug(`Ignoring load for ${file}:`, e.message.split(' from ')[0]);
      } else if (Env.watch) {
        console.error(`Stubbing out with error proxy due to error in compiling ${file}: `, e.message);
        return this.moduleManager.compile(m, jsf, CompilerUtil.getErrorModuleProxySource(e.message));
      } else {
        throw e;
      }
    }
  }

  markForReload(files: string[] | string, unlink = true) {
    if (!Array.isArray(files)) {
      files = [files];
    }
    for (const fileName of files) {
      this.unload(fileName, unlink);
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
    let changed: boolean = false;
    try {
      changed = this.sourceManager.transpile(fileName, {
        fileName,
        reportDiagnostics: true,
        transformers: this.transformerManager.transformers || {}
      }, force);
    } catch (err) {
      if (Env.watch) { // Handle transpilation errors
        this.sourceManager.set(fileName, CompilerUtil.getErrorModuleProxySource(err.message));
        changed = this.sourceManager.transpile(fileName, { fileName }, true);
      } else {
        throw err;
      }
    }

    if (changed && (force || this.presenceManager.isWatchedFileLoaded(fileName))) {
      // If file is already loaded, mark for reload
      this.markForReload(fileName, false); // Do not delete the file we just created
    }

    return changed;
  }

  on(event: WatchEvent, callback: (filename: string) => any) {
    this.events.addListener(event, callback);
  }

  off(event: WatchEvent, callback: (filename: string) => any) {
    this.events.removeListener(event, callback);
  }

  compileAll() {
    let compiled = 0;
    ScanApp.getStandardAppFiles().forEach(x => {
      if (!AppCache.hasEntry(x)) {
        compiled += 1;
        require(x);
      }
    });
    return compiled;
  }
}

export const Compiler = new $Compiler(Env.cwd);