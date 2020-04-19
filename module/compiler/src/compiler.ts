import * as fs from 'fs';

import { EventEmitter } from 'events';
import * as sourcemap from 'source-map-support';

import { FsUtil, AppCache, FileCache } from '@travetto/boot';
import { Env, Shutdown, FilePresenceManager, PresenceListener, ScanApp } from '@travetto/base';

import { SourceManager } from './source';
import { CompilerUtil } from './util';

type Module = {
  _compile?(file: string, contents: string): any;
} & NodeModule;

class $Compiler extends EventEmitter {

  private sourceManager: SourceManager;

  presenceManager: FilePresenceManager;
  active = false;

  constructor(
    private cwd: string = Env.cwd,
    private cache: FileCache = AppCache,
    private rootPaths: string[] = ScanApp.getAppPaths()
  ) {
    super();

    if (Env.watch) {
      Shutdown.onUnhandled(err => {
        if (err && (err.message ?? '').includes('Cannot find module')) { // Handle module reloading
          console.error(err);
          return true;
        }
      }, 0);
    }

    this.sourceManager = new SourceManager(this.cwd, this.cache, this.rootPaths);
    this.presenceManager = new FilePresenceManager({
      ext: '.ts',
      cwd: this.cwd,
      excludeFiles: [/.*.d.ts$/, new RegExp(`${this.cwd}/index.ts`), /\/node_modules\//], // DO not look into node_modules, only user code
      rootPaths: this.rootPaths,
      listener: this,
      initialFileValidator: x => !(x.file in require.cache) // Skip already imported files
    });
  }

  private loadFile(fileName: string) {
    return fs.readFileSync(fileName, 'utf-8');
  }

  init() {
    if (this.active) {
      return;
    }

    const start = Date.now();
    this.active = true;
    require.extensions['.ts'] = this.compile.bind(this);
    this.sourceManager.init();
    this.presenceManager.init();

    // register source maps
    sourcemap.install(this.sourceManager.getSourceMapHandler());

    console.debug('Initialized', (Date.now() - start) / 1000);
  }

  reset() {
    this.sourceManager.reset();
    this.presenceManager.reset();
    ScanApp.clearCache();
    this.active = false;

    this.init();
  }

  notify(type: keyof PresenceListener, fileName: string) {
    console.trace(`File ${type}`, fileName);
    this.emit(type, fileName);
  }

  unload(fileName: string, unlink = false) {
    this.sourceManager.unload(fileName, unlink); // Remove source
    const native = FsUtil.toNative(fileName);
    if (native in require.cache) {
      delete require.cache[native]; // Remove require cached element
    }
  }

  removed(fileName: string) {
    this.unload(fileName, true);
    this.notify('removed', fileName);
  }

  added(fileName: string) {
    if (this.presenceManager.isWatchedFileKnown(fileName)) {
      this.unload(fileName);
    }
    require(fileName);
    this.notify('added', fileName);
  }

  changed(fileName: string) {
    if (this.sourceManager.hashChanged(fileName, this.loadFile(fileName))) {
      this.unload(fileName);
      require(fileName);
      this.notify('changed', fileName);
    }
  }

  compile(m: Module, tsf: string) {
    const isNew = !this.presenceManager.has(tsf);
    try {
      const js = this.sourceManager.getTranspiled(tsf); // Compile
      const jsf = FsUtil.toJS(tsf);
      try {
        return m._compile!(js, jsf);
      } catch (e) {
        const errorContent = CompilerUtil.handleCompileError(e, this.cwd, m.filename, tsf);
        if (errorContent) {
          return m._compile!(errorContent, jsf);
        }
      }
    } finally {
      // If known by the source manager, track it's presence
      //   some files will be transpile only, and should not trigger
      //   presence activity
      if (isNew && this.sourceManager.hasContents(tsf)) {
        this.presenceManager.addNewFile(tsf, false);
      }
    }
  }
}

export const Compiler = new $Compiler();