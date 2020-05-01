import * as fs from 'fs';

import { EventEmitter } from 'events';
import * as sourcemap from 'source-map-support';

import { FsUtil, AppCache, FileCache, RegisterUtil, TranspileUtil } from '@travetto/boot';
import { Env, ShutdownManager, FilePresenceManager, PresenceListener, ScanApp } from '@travetto/base';

import { SourceManager } from './source';

// TODO: Document
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
      ShutdownManager.onUnhandled(err => {
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

  getRootFiles() {
    return this.sourceManager.getRootFiles();
  }

  init() {
    if (this.active) {
      return;
    }

    const start = Date.now();
    this.active = true;
    require.extensions[TranspileUtil.ext] = this.compile.bind(this);
    this.sourceManager.init();
    this.presenceManager.init();

    // register source maps
    sourcemap.install(this.sourceManager.getSourceMapHandler());

    console.debug('Initialized', (Date.now() - start) / 1000);
  }

  reset() {
    this.sourceManager.reset();
    this.presenceManager.reset();
    ScanApp.reset();
    this.active = false;
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

  compile(m: NodeModule, tsf: string) {
    const isNew = !this.presenceManager.has(tsf);
    try {
      return RegisterUtil.doCompile(m, this.sourceManager.getTranspiled(tsf), tsf);
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