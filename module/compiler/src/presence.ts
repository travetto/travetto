import { Watcher, Entry, AppEnv, Handler, findAppFilesByExt } from '@travetto/base';
import { CompilerUtil } from './util';
import * as path from 'path';

const EMPTY = (...args: any[]): any => { }

export interface Listener {
  added(name: string): any;
  changed(name: string): any;
  removed(name: string): any;
}

export class FilePresenceManager {
  fileWatchers: { [key: string]: Watcher } = {};
  files = new Map<string, { version: number }>();

  constructor(private cwd: string, private listener: Listener, private excludeFiles: RegExp[], private watch: boolean = AppEnv.watch) {
  }

  init() {
    const rootFiles = findAppFilesByExt('.ts')
      .filter(x => x.file.includes('/src/') && this.validFile(x.file))
      .map(x => x.file);

    console.debug('Files', rootFiles.length);

    for (const fileName of rootFiles) {
      this.files.set(fileName, { version: 0 });
      this.listener.added(fileName);
    }

    if (this.watch) {
      this.buildWatcher(`${this.cwd}/src`, [{ testFile: x => this.validFile(x) && /.*[.]ts$/.test(x) }]);
    }
  }

  has(name: string) {
    return this.files.has(name);
  }

  validFile(name: string) {
    for (const re of this.excludeFiles) {
      if (re.test(name)) {
        return false;
      }
    }
    return true;
  }

  addNewFile(name: string) {
    if (this.watch) {
      const topLevel = name.split(`${this.cwd}/`)[1].split('/')[0];

      if (this.fileWatchers[topLevel]) {
        this.fileWatchers[topLevel].add([name]);
      } else {
        this.buildWatcher(path.dirname(name), [{ testFile: x => x === path.basename(name) }]);
      }
    }
    this.files.set(name, { version: 0 });
    this.listener.added(name);
  }

  private watcherListener({ event, entry }: { event: string, entry: Entry }) {
    if (!this.validFile(entry.file)) {
      return;
    }

    console.debug('Watch', event, entry.file);

    if (event === 'added') {
      this.files.set(entry.file, { version: 1 });
      this.listener.added(entry.file);
    } else if (event === 'changed') {
      const changed = this.files.has(entry.file);
      if (changed) {
        this.listener.changed(entry.file);
        this.files.get(entry.file)!.version++;
      } else {
        this.files.set(entry.file, { version: 1 });
        this.listener.added(entry.file);
      }
    } else if (event === 'removed') {
      this.listener.removed(entry.file);
    }
  }

  private buildWatcher(cwd: string, handlers: Handler[]) {
    const watcher = new Watcher({
      interval: 250,
      cwd
    });

    watcher.on('all', this.watcherListener.bind(this))

    watcher.add(handlers); // Watch ts files
    watcher.run(false);
    return watcher;
  }

  reset() {
    if (this.watch) {
      Object.values(this.fileWatchers).map(x => x.close());
      this.fileWatchers = {};
    }

    this.files.clear();
  }

  isWatchedFileLoaded(name: string) {
    return this.watch && this.files.get(name.replace('.js', '.ts'))!.version > 0;
  }
}