import { EventEmitter } from 'events';

import { FsUtil } from '@travetto/boot';
import { Env, Shutdown, FilePresenceManager, ScanApp } from '@travetto/base';

import { SourceManager } from './source';
import { CompilerUtil } from './util';

class $Compiler extends EventEmitter {

  private presenceManager: FilePresenceManager;
  private sourceManager: SourceManager;

  active = false;

  constructor(public cwd: string, private rootPaths: string[]) {
    super();

    if (Env.watch) {
      Shutdown.onUnhandled(err => {
        if (err && (err.message || '').includes('Cannot find module')) { // Handle module reloading
          console.error(err);
          return true;
        }
      }, 0);
    }

    this.sourceManager = new SourceManager(cwd, {});
    this.presenceManager = new FilePresenceManager({
      ext: '.ts',
      cwd: this.cwd,
      rootPaths: this.rootPaths,
      listener: this,
      excludeFiles: [/node_modules/, /[.]d[.]ts$/],
      initialFileValidator: x => !(x.file in require.cache)
    });
  }

  initialLoad() {
    const rootsRe = Env.rootMatcher(this.rootPaths);

    ScanApp
      .findFiles('.ts', f => (rootsRe.test(f) || CompilerUtil.isCompilable(f)))
      .forEach(x => this.added(x.file)); // Load all files, class scanning
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
    this.initialLoad();
    console.debug('Initialized', (Date.now() - start) / 1000);
  }

  reset() {
    this.sourceManager.clear();
    this.presenceManager.reset();
    this.active = false;

    this.init();
  }

  added(fileName: string, load = true, emit = true) {
    console.trace('File Added', fileName);
    if (!this.presenceManager.has(fileName)) {
      this.presenceManager.addNewFile(fileName, false);
    }
    if (this.presenceManager.isWatchedFileKnown(fileName.replace(/[.]js$/, '.ts'))) {
      this.removed(fileName, false, false);
    }
    if (this.sourceManager.transpile(fileName)) {
      if (load) {
        require(fileName);
      }
      if (emit) {
        this.emit('added', fileName);
      }
    }
  }

  changed(fileName: string) {
    console.trace('File Changed', fileName);
    if (this.sourceManager.transpile(fileName, true)) {
      this.removed(fileName, false, false);

      setTimeout(() => {
        require(fileName);
        this.emit('changed', fileName);
      }, 10);
    }
  }

  removed(fileName: string, unlink = true, emit = true) {
    console.trace('File Removed', fileName);
    this.sourceManager.unload(fileName, unlink);
    const native = FsUtil.toNative(fileName);

    if (native in require.cache) {
      delete require.cache[native];
    }
    if (emit) {
      this.emit('removed', fileName);
    }
  }

  compile(m: NodeModule, tsf: string) {
    if (!this.presenceManager.has(tsf)) { // Is new
      this.added(tsf);
    }
    return this.sourceManager.compile(m, tsf);
  }
}

export const Compiler = new $Compiler(Env.cwd, Env.computeAppRoots().map(x => FsUtil.joinUnix(x, 'src')));