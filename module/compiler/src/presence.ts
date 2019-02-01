import * as path from 'path';

import { Watcher, ScanEntry, Env, ScanHandler, ScanApp, FsUtil } from '@travetto/base';

export interface Listener {
  added(name: string): any;
  changed(name: string): any;
  removed(name: string): any;
}

export class FilePresenceManager {
  fileWatchers: { [key: string]: Watcher } = {};
  files = new Map<string, { version: number }>();
  seen = new Set<string>();
  watchSpaces = new Set<string>();

  constructor(private cwd: string, private listener: Listener, private excludeFiles: RegExp[], private watch: boolean = Env.watch) {
    this.watchSpaces.add('src');
    if (Env.appRoot) {
      this.watchSpaces.add(FsUtil.joinUnix(Env.appRoot, 'src'));
    }
  }

  private watcherListener({ event, entry }: { event: string, entry: ScanEntry }) {
    if (!this.validFile(entry.file)) {
      return;
    }

    console.trace('Watch', event, entry.file);

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

  private buildWatcher(cwd: string, handlers: ScanHandler[]) {
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
    const SRC_RE = new RegExp(`^(${Env.appRoot || '-'})?(\/src\/.*|index)$`);

    const rootFiles = ScanApp.findFiles('.ts', x => SRC_RE.test(x) && this.validFile(x)) // Only watch own files
      .filter(x => !(x.file in require.cache)) // Pre-loaded items are fundamental and non-reloadable
      .map(x => x.file);

    for (const fileName of rootFiles) {
      this.files.set(fileName, { version: 0 });
      this.listener.added(fileName);
    }

    if (this.watch) { // Start watching after startup
      setTimeout(() => {
        console.debug('Watching files', rootFiles.length);
        for (const p of this.watchSpaces) {
          this.buildWatcher(FsUtil.joinUnix(this.cwd, p), [{ testFile: x => this.validFile(x) && x.endsWith('.ts') }]);
        }
      }, 1000);
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

    // Only watch workspace files, not node_modules
    if (this.watch && !name.includes('node_modules')) {
      // Already known to be a used file, just don't watch node modules
      const topLevel = path.dirname(name);
      if (!this.fileWatchers[topLevel]) {
        this.fileWatchers[topLevel] = this.buildWatcher(topLevel, []);
      }
      this.fileWatchers[topLevel].add([name.replace(`${topLevel}/`, '')]);
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