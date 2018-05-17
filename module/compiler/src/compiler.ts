import * as ts from 'typescript';
import { EventEmitter } from 'events';

import { AppInfo } from '@travetto/base';
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

  options: ts.CompilerOptions;
  transformerManager: TransformerManager;
  active = false;

  // Event manager
  events = new EventEmitter();

  constructor(public cwd: string = process.cwd()) {

    const exclude = [/\.d\.ts$/g]; // Definition files

    // Get Files proper like
    if (AppInfo.DEV_PACKAGES && AppInfo.DEV_PACKAGES.length) {
      exclude.push(new RegExp(`${CompilerUtil.LIBRARY_PATH}/(${AppInfo.DEV_PACKAGES.join('|')})/`));
    }

    this.options = CompilerUtil.resolveOptions(this.cwd);
    this.transformerManager = new TransformerManager(this.cwd);
    this.moduleManager = new ModuleManager(this.cwd);
    this.sourceManager = new SourceManager();
    this.presenceManager = new FilePresenceManager(this.cwd, {
      added: (name: string) => {
        if (this.transpile(name)) {
          this.events.emit('added', name);
        }
      },
      changed: (name: string) => {
        this.unload(name);
        if (this.transpile(name)) {
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

    if (/\/test\//.test(tsf) && !tsf.includes(CompilerUtil.LIBRARY_PATH)) {
      console.debug(content);
    }

    const ret = this.moduleManager.compile(m, jsf, content);
    if (ret) {
      if (isNew) {
        this.events.emit('required-after', tsf);
      }
    } else {
      this.sourceManager.set(tsf, CompilerUtil.EMPTY_MODULE);
    }
    return ret;
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

  unload(fileName: string) {
    console.debug('Unloading', fileName);

    if (this.sourceManager.has(fileName)) {
      this.sourceManager.unload(fileName);
    }

    if (fileName in require.cache) {
      delete require.cache[fileName];
    }

    this.moduleManager.unload(fileName);
  }

  transpile(fileName: string) {
    const changed = this.sourceManager.transpile(fileName, {
      compilerOptions: this.options,
      fileName,
      reportDiagnostics: true,
      transformers: this.transformerManager.transformers
    });

    if (changed && this.presenceManager.isWatchedFileLoaded(fileName)) {
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

export const Compiler = new $Compiler();

export const Name = 20;