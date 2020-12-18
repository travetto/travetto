import { ScanEntry } from '@travetto/boot';
import { EventEmitter } from 'events';
import { Watcher, WatcherOptions } from './watcher';


export interface FilePresenceManager {
  on(type: 'all', handlder: (payload: { event: string, entry: ScanEntry }) => void): this;
  on(type: 'added', handlder: (entry: ScanEntry) => void): this;
  on(type: 'addedDir', handlder: (entry: ScanEntry) => void): this;
  on(type: 'removed', handlder: (entry: ScanEntry) => void): this;
  on(type: 'removedDir', handlder: (entry: ScanEntry) => void): this;
  on(type: 'changed', handlder: (entry: ScanEntry) => void): this;
  on(type: string | symbol, handler: (...payload: any[]) => void): this;
}

type Opts = WatcherOptions & {
  validFile?: (f: string) => boolean;
};

/**
 * Tracks file changes for the application roots,
 * and handles multiple file roots.
 */
// eslint-disable-next-line no-redeclare
export class FilePresenceManager extends EventEmitter {
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
  private watcherListener({ event, entry }: { event: string, entry: ScanEntry }) {
    switch (event) {
      case 'added':
      case 'changed':
      case 'removed':
        if (this.config.validFile && !this.config.validFile(entry.file)) {
          return;
        }
        break;
    }
    this.emit('all', { event, entry });
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