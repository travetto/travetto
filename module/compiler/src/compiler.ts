import { EventEmitter } from 'events';

import { FsUtil } from '@travetto/boot';
import { Env, AppError, FilePresenceManager, Shutdown } from '@travetto/base';

import { TransformerManager } from './transformer/manager';
import { SourceManager } from './source';
import { CompilerUtil } from './util';

type WatchEvent = 'required-after' | 'added' | 'changed' | 'removed';

class $Compiler {

  sourceManager: SourceManager;
  presenceManager: FilePresenceManager;
  transformerManager: TransformerManager;
  active = false;

  // Event manager
  events = new EventEmitter();

  constructor(public cwd: string) {

    // Get Files proper like
    this.transformerManager = new TransformerManager(this.cwd);
    this.sourceManager = new SourceManager(this.cwd, {});

    const rootPaths = [
      ...Env.appRoots,
      ...(Env.appRoots.length && !Env.appRoots.includes('.') ? ['.'] : [])
    ].map(x => FsUtil.joinUnix(x, 'src'));

    this.presenceManager = new FilePresenceManager({
      ext: '.ts',
      cwd: this.cwd,
      rootPaths,
      listener: {
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
      },
      excludedFiles: [/node_modules/, /[.]d[.]ts$/],
      initialFileValidator: x => !(x.file in require.cache)
    });

    if (Env.watch) {
      Shutdown.onUnhandled(err => {
        if (err && (err.message || '').includes('Cannot find module')) { // Handle module reloading
          console.error(err);
          return true;
        }
      }, 0);
    }
  }

  init() {
    if (this.active) {
      return;
    }

    this.active = true;
    this.sourceManager.registerSourceMaps();
    this.transformerManager.init();
    require.extensions['.ts'] = this.requireHandler.bind(this);

    const start = Date.now();
    this.presenceManager.init();
    console.debug('Initialized', (Date.now() - start) / 1000);
  }

  reset() {
    this.sourceManager.clear();
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
      const res = (m as any)._compile(content, jsf);
      if (isNew) {
        this.events.emit('required-after', tsf);
      }
      return res;
    } catch (e) {

      if (e.message.startsWith('Cannot find module') || e.message.startsWith('Unable to load')) {
        const modName = m.filename.replace(`${this.cwd}/`, '');
        e = new AppError(`${e.message} ${e.message.includes('from') ? `[via ${modName}]` : `from ${modName}`}`, 'general');
      }

      const file = tsf.replace(`${Env.cwd}/`, '');
      if (tsf.includes('/extension/')) { // If errored out on extension loading
        console.debug(`Ignoring load for ${file}:`, e.message.split(' from ')[0]);
      } else if (Env.watch) {
        console.error(`Stubbing out with error proxy due to error in compiling ${file}: `, e.message);
        const content = CompilerUtil.getErrorModuleProxySource(e.message);
        return (m as any)._compile(content, jsf)
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
  }

  transpile(fileName: string, force = false) {
    let changed: boolean = false;
    try {
      changed = this.sourceManager.transpile(fileName, {
        fileName,
        reportDiagnostics: true,
        transformers: this.transformerManager.transformers ?? {}
      }, force);
    } catch (err) {
      if (Env.watch) { // Handle transpilation errors
        this.sourceManager.set(fileName, CompilerUtil.getErrorModuleProxySource(err.message));
        changed = this.sourceManager.transpile(fileName, { fileName }, true);
      } else {
        throw err;
      }
    }

    if (changed && (force || this.presenceManager.isWatchedFileKnown(fileName.replace(/[.]js$/, '.ts')))) {
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
}

export const Compiler = new $Compiler(Env.cwd);