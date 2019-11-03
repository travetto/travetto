import { EventEmitter } from 'events';

import { Compiler } from '@travetto/compiler';
import { FsUtil } from '@travetto/boot';
import { Env, AppInfo, ScanApp, FilePresenceManager } from '@travetto/base';

import { Class, ChangeSource, ChangeEvent } from '../types';
import { PendingRegister } from '../decorator';

export class CompilerClassSource implements ChangeSource<Class> {

  private classes = new Map<string, Map<string, Class>>();
  private events = new EventEmitter();
  private presenceManager: FilePresenceManager;

  constructor(private rootPaths: string[]) {
    const sourcedRootPaths = [
      ...rootPaths,
      ...(rootPaths.length && !rootPaths.includes('.') ? ['.'] : [])
    ].map(x => FsUtil.joinUnix(x, 'src'));

    this.presenceManager = new FilePresenceManager({
      ext: '.ts',
      cwd: Env.cwd,
      rootPaths: sourcedRootPaths,
      listener: {
        added: (name: string) => {
          if (Compiler.transpile(name)) {
            this.onFileChanged(name);
            this.flush();
          }
        },
        changed: (name: string) => {
          if (Compiler.transpile(name, true)) {
            this.onFileChanged(name, true);
          }
        },
        removed: (name: string) => {
          Compiler.unload(name);
          this.handleFileChanges(name);
        }
      },
      excludedFiles: [/node_modules/, /[.]d[.]ts$/],
      initialFileValidator: x => !(x.file in require.cache)
    });
  }

  private flush() {
    for (const [file, classes] of PendingRegister.flush()) {
      if (!classes || !classes.length) {
        continue;
      }
      this.classes.set(file, new Map());
      for (const cls of classes) {
        this.classes.get(cls.__filename)!.set(cls.__id, cls);
        this.emit({ type: 'added', curr: cls });
      }
    }
  }

  protected async handleFileChanges(file: string, classes: Class<any>[] = []) {
    const next = new Map(classes.map(cls => [cls.__id, cls] as [string, Class]));

    let prev = new Map<string, Class>();
    if (this.classes.has(file)) {
      prev = new Map(this.classes.get(file)!.entries());
    }

    const keys = new Set([...Array.from(prev.keys()), ...Array.from(next.keys())]);

    if (!this.classes.has(file)) {
      this.classes.set(file, new Map());
    }

    for (const k of keys) {
      if (!next.has(k)) {
        this.emit({ type: 'removing', prev: prev.get(k)! });
        this.classes.get(file)!.delete(k);
      } else {
        this.classes.get(file)!.set(k, next.get(k)!);
        if (!prev.has(k)) {
          this.emit({ type: 'added', curr: next.get(k)! });
        } else if (prev.get(k)!.__hash !== next.get(k)!.__hash) {
          this.emit({ type: 'changed', curr: next.get(k)!, prev: prev.get(k) });
        }
      }
    }
  }

  protected async onFileChanged(fileName: string, force = false) {
    if (force || this.presenceManager.isWatchedFileKnown(fileName.replace(/[.]js$/, '.ts'))) {
      Compiler.unload(fileName, false);
    }

    require(fileName);

    for (const [file, classes] of PendingRegister.flush()) {
      this.handleFileChanges(file, classes);
    }
  }

  emit(e: ChangeEvent<Class>) {
    this.events.emit('change', e);
  }

  reset() {
    this.classes.clear();
    this.presenceManager.reset();
  }

  async init() {

    this.presenceManager.init();

    if (this.rootPaths.length) {
      const rootsRe = Env.appRootMatcher(this.rootPaths);

      const entries = await ScanApp.findFiles('.ts', (f: string) => {
        return this.presenceManager.validFile(f)
          && (rootsRe.test(f) || f.startsWith('extension/') || (
            /^node_modules\/@travetto\/[^\/]+\/(src|extension)\/.*/.test(f)
            && !f.includes('node_modules/@travetto/test') // Exclude test code by default
            && !f.startsWith(`node_modules/${AppInfo.NAME}/`)
          )); // No more side effect code, load all files
      }
      );

      const files = entries.map(x => x.file);

      for (const f of files) { // Load all files, class scanning
        require(f);
      }
    }

    this.flush();
  }

  on(callback: (e: ChangeEvent<Class>) => void): void {
    this.events.on('change', callback);
  }
}