import { Watcher, WatcherOptions } from './watcher';
import { AllEvent, WatchEmitter } from './emitter';

type Opts = WatcherOptions & {
  validFile?: (f: string) => boolean;
};

/**
 * Tracks file changes for the application roots,
 * and handles multiple file roots.
 */
export class FilePresenceManager extends WatchEmitter {
  private watchers = new Map<string, Watcher>();

  /**
   * Build a new file presence manager
   *
   * @param config
   */
  constructor(folders: string[], private config: Opts = {}) {
    super();
    this.addFolder(...folders);
    setTimeout(() => this.config.ignoreInitial = false, 1000);
  }

  /**
   * Callback handle for the watcher
   */
  private watcherListener({ event, entry }: AllEvent) {
    switch (event) {
      case 'added':
      case 'changed':
      case 'removed':
        if (this.config.validFile && !this.config.validFile(entry.file)) {
          return;
        }
        break;
    }
    this.emit(event, entry);
  }

  /**
   * Add a folder
   */
  addFolder(...folders: string[]) {
    for (const folder of folders.filter(x => !this.watchers.has(x))) {
      this.watchers.set(folder, new Watcher(folder, this.config)
        .on('all', this.watcherListener.bind(this)));
    }
  }

  /**
   * Remove a folder
   * @param folder
   */
  removeFolder(...folders: string[]) {
    for (const folder of folders.filter(x => this.watchers.has(x))) {
      this.watchers.get(folder)!.close();
      this.watchers.delete(folder);
    }
  }

  /**
   * Close manager, freeing all watchers
   */
  close() {
    this.removeFolder(...this.watchers.keys());
  }
}