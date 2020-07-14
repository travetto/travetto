import * as path from 'path';

import { FsUtil, ScanEntry } from '@travetto/boot';

import { Watcher } from './watcher';

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
  private fileWatchers = new Map<string, Watcher>();

  private validFile: (f: string) => boolean;
  private cwd: string;
  private listener: PresenceListener;
  private files = new Set<string>();
  private folders = new Set<string>();

  /**
   * Build a new file presence manager
   *
   * @param config
   */
  constructor(
    config: {
      validFile: FilePresenceManager['validFile'];
      cwd: FilePresenceManager['cwd'];
      folders: FilePresenceManager['folders'] | string[];
      files: FilePresenceManager['files'] | string[];
      listener: Partial<FilePresenceManager['listener']>;
    }
  ) {
    config.files = new Set(config.files);
    config.folders = new Set(config.folders);

    for (const k of ['added', 'removed', 'changed'] as const) {
      config.listener[k] = config.listener[k] || (() => { });
    }

    Object.assign(this, config);
  }

  /**
   * Callback handle for the watcher
   */
  private watcherListener({ event, entry }: { event: string, entry: ScanEntry }) {
    if (!this.validFile(entry.file)) {
      return;
    }

    console.debug('Watch', event, entry.file);
    switch (event) {
      case 'added': {
        this.files.add(entry.file);
        return this.listener.added(entry.file);
      }
      case 'changed': {
        const changed = this.files.has(entry.file);
        if (changed) {
          this.listener.changed(entry.file);
          return;
        } else {
          this.files.add(entry.file);
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
  private buildWatcher(cwd: string) {
    return new Watcher({ interval: 250, cwd })
      .on('all', this.watcherListener.bind(this))
      .add([{ testFile: this.validFile, testDir: this.validFile }])
      .run(false);
  }

  /**
   * Initialize manager
   */
  init() {
    setTimeout(() => this.folders.forEach(p => this.addNewFolder(p)), 50); // TODO: Should be definitive here, 1000 og
  }

  /**
   * Add new folder to watch
   */
  addNewFolder(folder: string) {
    if (!FsUtil.existsSync(folder)) {
      console.warn(`Directory ${FsUtil.resolveUnix(folder)} missing, cannot watch`);
    } else {
      this.buildWatcher(FsUtil.resolveUnix(folder));
    }
  }

  /**
   * Determine if file is known
   */
  has(name: string) {
    return this.files.has(name);
  }

  /**
   * Add an individual file
   *
   * @param name File path
   * @param notify Wether or not to emit on addition
   */
  addNewFile(name: string, notify = true) {
    if (this.files.has(name)) {
      return;
    }

    if (this.validFile(name)) {
      // Already known to be a used file, just don't watch node modules
      const topLevel = path.dirname(name);
      if (!this.fileWatchers.has(topLevel)) {
        this.fileWatchers.set(topLevel, this.buildWatcher(topLevel));
      }
      this.fileWatchers.get(topLevel)!.add([name.replace(`${topLevel}/`, '')]);
    }

    this.files.add(name);

    if (notify) {
      this.listener.added(name);
    }
  }

  /**
   * Close manager, freeing all watchers
   */
  close() {
    [...this.fileWatchers.values()].forEach(x => x.close());
    this.fileWatchers.clear();
    this.files.clear();
    this.folders.clear();
  }
}