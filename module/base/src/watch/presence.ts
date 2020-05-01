import * as path from 'path';
import * as fs from 'fs';

import { FsUtil } from '@travetto/boot';

import { Watcher } from './watcher';
import { ScanEntry, ScanHandler } from '../scan-fs';
import { Env } from '../env';
import { ScanApp } from '../scan-app';
import { SystemUtil } from '../system';

export interface PresenceListener {
  added(name: string): void;
  changed(name: string): void;
  removed(name: string): void;
}

/**
 * Tracks file changes for the application roots,
 * and handles multiple file roots.
 */
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

  /**
   * Build a new file presence manager
   *
   * @param config
   */
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

  /**
   * Default to always true
   */
  private initialFileValidator: (x: Pick<ScanEntry, 'file' | 'module'>) => boolean = x => true;

  /**
   * Callback handle for the watcher
   */
  private watcherListener({ event, entry }: { event: string, entry: ScanEntry }) {
    if (!this.validFile(entry.file)) {
      return;
    }

    console.trace('Watch', event, entry.file);
    switch (event) {
      case 'added': {
        this.files.set(entry.file, { version: 1 });
        return this.listener.added(entry.file);
      }
      case 'changed': {
        const changed = this.files.has(entry.file);
        if (changed) {
          this.listener.changed(entry.file);
          this.files.get(entry.file)!.version++;
          return;
        } else {
          this.files.set(entry.file, { version: 1 });
          return this.listener.added(entry.file);
        }
      }
      case 'removed': {
        this.files.delete(entry.file);
        return this.listener.removed(entry.file);
      }
    }
  }

  /**
   * Add a new watcher for a specific root
   */
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

  /**
   * Collect all root files given the provided rootPaths
   */
  getRootFiles() {
    const PATH_RE = SystemUtil.pathMatcher(this.rootPaths);

    const rootFiles = ScanApp.findFiles(this.ext, x => PATH_RE.test(x) && this.validFile(x)) // Only watch own files
      .filter(x => this.initialFileValidator(x)) // Validate root files follow some pattern
      .map(x => x.file);

    return rootFiles;
  }

  /**
   * Initialize manager
   */
  init() {
    const rootFiles = this.getRootFiles();

    for (const fileName of rootFiles) {
      this.files.set(fileName, { version: 0 });
    }

    if (this.watch) { // Start watching after startup
      setTimeout(() => this.watchSpaces.forEach(p => this.addNewFolder(p)), 50); // FIXME: 1000 og
    }
  }

  /**
   * Add new folder to watch
   */
  addNewFolder(folder: string) {
    if (!fs.existsSync(folder)) {
      console.warn(`Directory ${FsUtil.resolveUnix(FsUtil.cwd, folder)} missing, cannot watch`);
    } else {
      this.buildWatcher(FsUtil.joinUnix(this.cwd, folder), [{ testFile: x => this.validFile(x), testDir: x => this.validFile(x) }]);
    }
  }

  /**
   * Determine if file is known
   */
  has(name: string) {
    return this.files.has(name);
  }

  /**
   * Tests to see if passed in file is valid
   */
  validFile(name: string) {
    for (const re of this.excludeFiles) {
      if (re.test(name)) {
        return false;
      }
    }
    return name.endsWith(this.ext);
  }

  /**
   * Add an individual file
   *
   * @param name File path
   * @param notify Wether or not to emit on addition
   */
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

  /**
   * Reset manager, freeing all watchers
   */
  reset() {
    if (this.watch) {
      Object.values(this.fileWatchers).map(x => x.close());
      this.fileWatchers = {};
    }
    this.seen.clear();
    this.files.clear();
  }

  /**
   * Has this file been watched before
   */
  isWatchedFileKnown(name: string) {
    return this.watch && this.files.get(name)!.version > 0;
  }
}