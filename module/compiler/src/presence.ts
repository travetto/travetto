import { Watcher, Entry, AppEnv, bulkFindSync } from '@travetto/base';
import { CompilerUtil } from './util';

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
    const rootFiles = bulkFindSync([/[^\/]+\/src\/.*[.]ts$/], `${this.cwd}/${CompilerUtil.LIBRARY_PATH}/@travetto`)
      .concat(bulkFindSync([/.ts/], `${this.cwd}/src`))
      .filter(x => !x.stats.isDirectory() && this.validFile(x.file))
      .map(x => x.file);

    console.debug('Files', rootFiles.length);

    for (const fileName of rootFiles) {
      this.files.set(fileName, { version: 0 });
      this.listener.added(fileName);
    }

    if (this.watch) {
      this.buildWatcher('src');
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
      }
    }
    this.files.set(name, { version: 0 });
    this.listener.added(name);
  }

  private watcherListener({ event, entry }: { event: string, entry: Entry }) {
    if (!this.validFile(entry.file)) {
      return;
    }

    console.log('Watch', event, entry.file);

    if (event === 'added') {
      this.files.set(entry.file, { version: 1 });
      this.listener.added(entry.file);
    } else if (event === 'changed') {
      const changed = this.files.has(entry.file);
      if (changed) {
        this.listener.changed(entry.file);
        this.files.get(entry.file)!.version++;
      } else {
        this.listener.added(entry.file);
        this.files.set(entry.file, { version: 1 });
      }
    } else if (event === 'removed') {
      this.listener.removed(entry.file);
    }
  }

  private buildWatcher(tld: string) {
    const watcher = new Watcher({
      interval: 250,
      cwd: `${this.cwd}/${tld}`
    });

    watcher.on('all', this.watcherListener.bind(this))

    watcher.add([/.*[.]ts$/]); // Watch ts files
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
    return this.watch && this.files.get(name)!.version > 0;
  }
}