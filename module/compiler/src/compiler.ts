import * as fs from 'fs';
import { EventEmitter } from 'events';

import { FsUtil } from '@travetto/boot';
import { Env, Shutdown, FilePresenceManager, PresenceListener, ScanApp } from '@travetto/base';

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

    const rootsRe = Env.rootMatcher(this.rootPaths);
    ScanApp.requireFiles('.ts', f => rootsRe.test(f) || CompilerUtil.isCompilable(f)); // Load all files, class scanning

    console.debug('Initialized', (Date.now() - start) / 1000);
  }

  reset() {
    this.sourceManager.reset();
    this.presenceManager.reset();
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

  compile(m: NodeModule, tsf: string) {
    const isNew = !this.presenceManager.has(tsf);
    try {
      const content = this.loadFile(tsf);
      const js = this.sourceManager.transpile(tsf, content); // Compile
      return CompilerUtil.compile(this.cwd, m, tsf, js);
    } finally {
      if (isNew) {
        this.presenceManager.addNewFile(tsf, false);
      }
    }
  }
}

export const Compiler = new $Compiler(Env.cwd, Env.computeAppRoots().map(x => FsUtil.joinUnix(x, 'src')));