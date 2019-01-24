import { Watcher, ScanEntry, Env, ScanHandler, ScanApp, FsUtil } from '@travetto/base';

export interface Listener {
  added(name: string): any;
  changed(name: string): any;
  removed(name: string): any;
}

export class FilePresenceManager {
  fileWatchers: { [key: string]: Watcher } = {};
  uris = new Map<string, { version: number }>();
  seen = new Set<string>();
  watchSpaces = new Set<string>();

  constructor(private cwd: string, private listener: Listener, private excludeFiles: RegExp[], private watch: boolean = Env.watch) {
    this.watchSpaces.add('src');
    if (Env.appRoot) {
      this.watchSpaces.add(FsUtil.resolveURI(Env.appRoot, 'src'));
    }
  }

  private watcherListener({ event, entry }: { event: string, entry: ScanEntry }) {
    if (!this.validFile(entry.uri)) {
      return;
    }

    console.trace('Watch', event, entry.uri);

    if (event === 'added') {
      this.uris.set(entry.uri, { version: 1 });
      this.listener.added(entry.uri);
    } else if (event === 'changed') {
      const changed = this.uris.has(entry.uri);
      if (changed) {
        this.listener.changed(entry.uri);
        this.uris.get(entry.uri)!.version++;
      } else {
        this.uris.set(entry.uri, { version: 1 });
        this.listener.added(entry.uri);
      }
    } else if (event === 'removed') {
      this.uris.delete(entry.uri);
      this.listener.removed(entry.uri);
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
      .filter(x => !(x.uri in require.cache)) // Pre-loaded items are fundamental and non-reloadable
      .map(x => x.uri);

    for (const fileName of rootFiles) {
      this.uris.set(fileName, { version: 0 });
      this.listener.added(fileName);
    }

    if (this.watch) { // Start watching after startup
      setTimeout(() => {
        console.debug('Watching files', rootFiles.length);
        for (const p of this.watchSpaces) {
          this.buildWatcher(FsUtil.resolveURI(this.cwd, p), [{ testFile: x => this.validFile(x) && x.endsWith('.ts') }]);
        }
      }, 1000);
    }
  }

  has(name: string) {
    return this.uris.has(name);
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
      const topLevel = FsUtil.dirname(name);
      if (!this.fileWatchers[topLevel]) {
        this.fileWatchers[topLevel] = this.buildWatcher(topLevel, []);
      }
      this.fileWatchers[topLevel].add([name.replace(`${topLevel}/`, '')]);
    }

    this.uris.set(name, { version: 0 });
    this.listener.added(name);
  }

  reset() {
    if (this.watch) {
      Object.values(this.fileWatchers).map(x => x.close());
      this.fileWatchers = {};
    }
    this.seen.clear();
    this.uris.clear();
  }

  isWatchedFileLoaded(name: string) {
    return this.watch && this.uris.get(name.replace('.js', '.ts'))!.version > 0;
  }
}