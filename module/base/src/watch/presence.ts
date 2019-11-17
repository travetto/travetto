import * as path from 'path';
import * as fs from 'fs';

import { FsUtil } from '@travetto/boot';

import { Watcher } from './watcher';
import { ScanEntry, ScanHandler } from '../scan-fs';
import { Env } from '../env';
import { ScanApp } from '../scan-app';

export interface PresenceListener {
  added(name: string): any;
  changed(name: string): any;
  removed(name: string): any;
}

export class FilePresenceManager {
  private ext: string;
  private cwd: string;
  private rootPaths: string[] = [];
  private listener: PresenceListener;
  private excludeFiles: RegExp[] = [];
  private watch: boolean = Env.watch;

  private fileWatchers: Record<string, Watcher> = {};
  private files = new Map<string, { version: number }>();
  private seen = new Set<string>();
  private watchSpaces = new Set<string>();

  constructor(
    config: {
      ext: FilePresenceManager['ext'];
      cwd: FilePresenceManager['cwd'];
      rootPaths: FilePresenceManager['rootPaths'];
      listener: FilePresenceManager['listener'];
      excludeFiles?: FilePresenceManager['excludeFiles'];
      initialFileValidator?: FilePresenceManager['initialFileValidator'];
      watch?: FilePresenceManager['watch'];
    }
  ) {
    for (const k of Object.keys(config) as (keyof FilePresenceManager)[]) {
      this[k] = (config as any)[k];
    }

    for (const root of this.rootPaths) {
      this.watchSpaces.add(root);
    }
  }

  private initialFileValidator: (x: Pick<ScanEntry, 'file' | 'module'>) => boolean = x => true;

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

  getRootFiles() {
    const SRC_RE = Env.rootMatcher(this.rootPaths);

    const rootFiles = ScanApp.findFiles(this.ext, x => SRC_RE.test(x) && this.validFile(x)) // Only watch own files
      .filter(x => this.initialFileValidator(x)) // Validate root files follow some pattern
      .map(x => x.file);

    return rootFiles;
  }

  init() {
    const rootFiles = this.getRootFiles();

    for (const fileName of rootFiles) {
      this.files.set(fileName, { version: 0 });
    }

    if (this.watch) { // Start watching after startup
      setTimeout(() => {
        for (const p of this.watchSpaces) {
          if (!fs.existsSync(p)) {
            console.warn(`Directory ${FsUtil.resolveUnix(FsUtil.cwd, p)} missing, cannot watch`);
            continue;
          }
          this.buildWatcher(FsUtil.joinUnix(this.cwd, p), [{ testFile: x => this.validFile(x), testDir: x => this.validFile(x) }]);
        }
      }, 50); // FIXME: 1000 og
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
    return name.endsWith(this.ext);
  }

  addNewFile(name: string, notify = true) {
    if (this.seen.has(name)) {
      return;
    }

    this.seen.add(name);

    if (this.watch && this.validFile(name)) {
      // Already known to be a used file, just don't watch node modules
      const topLevel = path.dirname(name);
      if (!this.fileWatchers[topLevel]) {
        this.fileWatchers[topLevel] = this.buildWatcher(topLevel, []);
      }
      this.fileWatchers[topLevel].add([name.replace(`${topLevel}/`, '')]);
    }

    this.files.set(name, { version: 0 });

    if (notify) {
      this.listener.added(name);
    }
  }

  reset() {
    if (this.watch) {
      Object.values(this.fileWatchers).map(x => x.close());
      this.fileWatchers = {};
    }
    this.seen.clear();
    this.files.clear();
  }

  isWatchedFileKnown(name: string) {
    return this.watch && this.files.get(name)!.version > 0;
  }
}