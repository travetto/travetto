import { Watcher, Entry, AppEnv, Handler, findAppFiles } from '@travetto/base';
import { CompilerUtil } from './util';
import * as path from 'path';

const EMPTY = (...args: any[]): any => { };

export interface Listener {
  added(name: string): any;
  changed(name: string): any;
  removed(name: string): any;
}

export class FilePresenceManager {
  fileWatchers: { [key: string]: Watcher } = {};
  files = new Map<string, { version: number }>();
  seen = new Set();

  constructor(private cwd: string, private listener: Listener, private excludeFiles: RegExp[], private watch: boolean = AppEnv.watch) {
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
      this.files.delete(entry.file);
      this.listener.removed(entry.file);
    }
  }

  private buildWatcher(cwd: string, handlers: Handler[]) {
    const watcher = new Watcher({
      interval: 250,
      cwd
    });

    watcher.on('all', this.watcherListener.bind(this));

    watcher.add(handlers); // Watch ts files
    watcher.run(false);
    return watcher;
  }

  init() {
    const rootFiles = findAppFiles('.ts', x => (x.endsWith('index.ts') || /(^src\/)|\/src\//.test(x)) && this.validFile(x))
      .filter(x => !(x.file in require.cache)) // Pre-loaded items are fundamental and non-reloadable
      .map(x => x.file);

    console.debug('Files', rootFiles.length);

    for (const fileName of rootFiles) {
      this.files.set(fileName, { version: 0 });
      this.listener.added(fileName);
    }

    if (this.watch) {
      this.buildWatcher(path.join(this.cwd, 'src'), [{ testFile: x => this.validFile(x) && x.endsWith('.ts') }]);
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
    if (this.seen.has(name)) {
      return;
    }
    this.seen.add(name);

    if (this.watch) {
      const topLevel = path.dirname(name);

      if (!this.fileWatchers[topLevel]) {
        this.fileWatchers[topLevel] = this.buildWatcher(topLevel, []);
      }
      this.fileWatchers[topLevel].add([name.replace(`${topLevel}${path.sep}`, '')]);
    }
    this.files.set(name, { version: 0 });
    this.listener.added(name);
  }

  reset() {
    if (this.watch) {
      Object.values(this.fileWatchers).map(x => x.close());
      this.fileWatchers = {};
    }
    this.seen.clear();
    this.files.clear();
  }

  isWatchedFileLoaded(name: string) {
    return this.watch && this.files.get(name.replace('.js', '.ts'))!.version > 0;
  }
}