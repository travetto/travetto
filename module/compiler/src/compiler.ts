import { FsUtil } from '@travetto/boot';
import { Env, Shutdown, FilePresenceManager } from '@travetto/base';

import { SourceManager } from './source';
import { EventEmitter } from 'events';

class $Compiler extends EventEmitter {

  private presenceManager: FilePresenceManager;
  private sourceManager: SourceManager;
  public rootPaths: string[];

  active = false;

  constructor(public cwd: string, rootPaths: string[]) {
    super();

    if (Env.watch) {
      Shutdown.onUnhandled(err => {
        if (err && (err.message || '').includes('Cannot find module')) { // Handle module reloading
          console.error(err);
          return true;
        }
      }, 0);
    }

    this.rootPaths = [...rootPaths];

    if (rootPaths.length && !rootPaths.includes('.')) {
      this.rootPaths.push('.');
    }

    this.rootPaths = this.rootPaths.map(x => FsUtil.joinUnix(x, 'src'));

    this.sourceManager = new SourceManager(cwd, {});
    this.presenceManager = new FilePresenceManager({
      ext: '.ts',
      cwd: this.cwd,
      rootPaths: this.rootPaths,
      listener: this,
      excludedFiles: [/node_modules/, /[.]d[.]ts$/],
      initialFileValidator: x => !(x.file in require.cache)
    });
  }

  init() {
    if (this.active) {
      return;
    }

    const start = Date.now();
    this.active = true;
    require.extensions['.ts'] = this.compile.bind(this);
    this.presenceManager.init();
    this.sourceManager.init();
    console.debug('Initialized', (Date.now() - start) / 1000);
  }

  reset() {
    this.sourceManager.clear();
    this.presenceManager.reset();
    this.active = false;

    this.init();
  }

  added(fileName: string, load = true) {
    console.trace('File Added', fileName);
    if (this.sourceManager.transpile(fileName)) {
      if (this.presenceManager.isWatchedFileKnown(fileName.replace(/[.]js$/, '.ts'))) {
        this.sourceManager.unloadModule(fileName, false);
      }
      if (load) {
        require(fileName);
      }
      this.emit('added', fileName);
    }
  }

  changed(fileName: string) {
    console.trace('File Changed', fileName);
    if (this.sourceManager.transpile(fileName, true)) {
      this.sourceManager.unloadModule(fileName, false);
      require(fileName);
      this.emit('changed', fileName);
    }
  }

  removed(fileName: string, unlink = true) {
    console.trace('File Removed', fileName);
    this.sourceManager.unloadModule(fileName, unlink);

    const native = FsUtil.toNative(fileName);
    if (native in require.cache) {
      delete require.cache[native];
    }

    this.emit('removed', fileName);
  }

  compile(m: NodeModule, tsf: string) {
    if (!this.sourceManager.has(tsf)) { // Is new
      this.presenceManager.addNewFile(tsf, false);
      this.added(tsf, false);
    }
    return this.sourceManager.compileModule(m, tsf);
  }
}

export const Compiler = new $Compiler(Env.cwd, Env.appRoots);