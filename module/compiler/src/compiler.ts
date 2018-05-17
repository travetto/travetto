import * as ts from 'typescript';
import { EventEmitter } from 'events';

import { bulkFindSync, AppEnv, AppInfo } from '@travetto/base';
import { TransformerManager } from './transformers';
import { CompilerUtil } from './util';
import { SourceManager } from './source';
import { ModuleManager } from './module';
import { FilePresenceManager } from './presence';

type WatchEvent = 'required-after' | 'added' | 'changed' | 'removed';

class $Compiler {

  // Caches
  moduleManager: ModuleManager;
  sourceManager: SourceManager;
  presenceManager: FilePresenceManager;

  // Transpile settings
  configFile = 'tsconfig.json';
  options: ts.CompilerOptions;
  tranformerManager: TransformerManager;
  active = false;

  // Event manager
  events = new EventEmitter();

  constructor(private cwd: string = process.cwd()) {

    const invalidWorkingSetFiles = [
      /\.d\.ts$/g, // Definition files
    ];

    // Get Files proper like
    if (AppInfo.DEV_PACKAGES && AppInfo.DEV_PACKAGES.length) {
      invalidWorkingSetFiles.push(new RegExp(`${CompilerUtil.LIBRARY_PATH}/(${AppInfo.DEV_PACKAGES.join('|')})/`));
    }

    this.options = CompilerUtil.resolveOptions(this.cwd, this.configFile);
    this.tranformerManager = new TransformerManager(this.cwd);
    this.moduleManager = new ModuleManager(this.cwd);
    this.sourceManager = new SourceManager();
    this.presenceManager = new FilePresenceManager(this.cwd, {
      added: (name: string) => {
        if (this.emitFile(name)) {
          this.events.emit('added', name);
        }
      },
      changed: (name: string) => {
        if (this.emitFile(name)) {
          this.events.emit('changed', name);
        }
      },
      removed: (name: string) => {
        this.unload(name);
        this.events.emit('removed', name);
      }
    }, invalidWorkingSetFiles);

    require.extensions['.ts'] = this.requireHandler.bind(this);
  }

  init() {
    if (this.active) {
      return;
    }
    this.active = true;

    const start = Date.now();
    // Now manage presence
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

    let content: string;

    const isNew = !this.sourceManager.has(jsf);

    if (isNew) {
      this.presenceManager.addNewFile(tsf);
      // Picking up missed files, transpile now
      this.emitFile(tsf);
    }

    // Log transpiled content as needed
    content = this.sourceManager.get(jsf)!;

    if (/\/test\//.test(tsf) && !tsf.includes(CompilerUtil.LIBRARY_PATH)) {
      console.debug(content);
    }

    const ret = this.moduleManager.compile(m, jsf, content);
    if (ret !== CompilerUtil.EMPTY_MODULE) {
      if (isNew) {
        this.events.emit('required-after', tsf);
      }
    } else {
      this.sourceManager.set(jsf, CompilerUtil.EMPTY_MODULE);
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

  emitFile(fileName: string) {
    const changed = this.sourceManager.compile(fileName, {
      compilerOptions: this.options,
      fileName,
      reportDiagnostics: true,
      transformers: this.tranformerManager.transformers
    });

    if (this.presenceManager.isWatchedFileLoaded(fileName)) {
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

const Compiler = new $Compiler();