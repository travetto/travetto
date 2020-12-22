import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as ts from 'typescript';

import { ScanEntry, ScanFs, FsUtil, ScanHandler } from '@travetto/boot';

/**
 * Watch Options
 */
export interface WatcherOptions {
  cwd?: string; // The relative cwd
  maxListeners?: number; // Max number of file listeners
  interval?: number; // Polling interval for watching
  ignoreInitial?: boolean; // Ignore intial load
  exclude?: ScanHandler;
}

export interface Watcher {
  on(type: 'all', handlder: (payload: { event: string, entry: ScanEntry }) => void): this;
  on(type: 'added', handlder: (entry: ScanEntry) => void): this;
  on(type: 'addedDir', handlder: (entry: ScanEntry) => void): this;
  on(type: 'removed', handlder: (entry: ScanEntry) => void): this;
  on(type: 'removedDir', handlder: (entry: ScanEntry) => void): this;
  on(type: 'changed', handlder: (entry: ScanEntry) => void): this;
  on(type: string | symbol, handler: (...payload: any[]) => void): this;
}

/**
 * Standard watcher built on node fs libs
 */
export class Watcher extends EventEmitter {

  private watched = new Map<string, ScanEntry>();
  private directories = new Map<string, { close: () => void }>();
  private files = new Map<string, { close: () => void }>();
  private suppress = false;

  /**
   * Create a new watcher, priming the root direction
   * as the starting point
   * @param opts
   */
  constructor(private folder: string, private options: WatcherOptions = {}) {
    super();

    this.options = { interval: 100, ...this.options };
    this.folder = FsUtil.resolveUnix(this.options.cwd || FsUtil.cwd, this.folder);

    // Set maxListeners
    if (this.options.maxListeners !== undefined) {
      this.setMaxListeners(this.options.maxListeners);
    }

    this.suppress = !!this.options.ignoreInitial;

    this.watch(
      { file: this.folder, module: this.folder, stats: fs.statSync(this.folder) },
      ...ScanFs.scanDirSync(this.options.exclude ?? { testFile: x => true, testDir: x => true }, this.folder)
    );

    // Allow initial suppression for 1s
    setTimeout(() => this.suppress = false, 1000);
  }

  /**
   * Handle when a directory if the target of a change event
   */
  private processDirectoryChange(dir: ScanEntry) {
    dir.children = dir.children ?? [];

    fs.readdir(dir.file, (err, current) => {
      if (err && !this.handleError(err)) {
        current = [];
      }

      // Convert to full paths
      current = current.filter(x => !x.startsWith('.')).map(x => FsUtil.joinUnix(dir.file, x));

      // Get watched files for this dir
      const previous = (dir.children ?? []).slice(0);

      // If file was deleted
      for (const child of previous) {
        if (current.indexOf(child.file) < 0) {

          // Remove from watching
          this.unwatch(child.file);
          dir.children!.splice(dir.children!.indexOf(child), 1);

          this.emit(ScanFs.isNotDir(child) ? 'removed' : 'removedDIr', child);
        }
      }

      const prevSet = new Set(previous.map(x => x.file));

      // If file was added
      for (const next of current) {
        const nextStats = fs.lstatSync(next);

        if (!prevSet.has(next)) {
          const sub = { file: next, module: next, stats: nextStats };
          this.watch(sub);
          dir.children!.push(sub);

          this.emit(ScanFs.isNotDir(sub) ? 'added' : 'addedDir', sub);
        }
      }
    });
  }

  /**
   * Start watching a directory using fs.watch
   */
  private watchDirectory(entry: ScanEntry) {
    if (ScanFs.isNotDir(entry)) {
      throw new Error(`Not a directory: ${entry.file}`);
    }

    try {
      console.debug('Watching Directory', { directory: entry.file });
      // const watcher = fs.watch(FsUtil.resolveUnix(entry.file), { persistent: false }, () => this.processDirectoryChange(entry);
      const watcher = ts.sys.watchDirectory!(FsUtil.resolveUnix(entry.file), () => this.processDirectoryChange(entry), false);

      // watcher.on('error', this.handleError.bind(this));
      this.directories.set(entry.file, watcher);

      this.processDirectoryChange(entry);

    } catch (err) {
      return this.handleError(err);
    }
  }

  /**
   * Start watching a file.  Registers a poller using fs.watch
   */
  private watchFile(entry: ScanEntry) {
    if (ScanFs.isDir(entry)) {
      throw new Error(`Not a file: ${entry.file}`);
    }

    const opts = { persistent: false, interval: this.options.interval };

    // const poller = () => {
    //   // Only emit changed if the file still exists
    //   // Prevents changed/deleted duplicate events
    //   try {
    //     // Get stats on file
    //     const stats = fs.lstatSync(entry.file);
    //     entry.stats = stats;

    //     this.emit('changed', entry);
    //   } catch (e) {
    //     if (this.handleError(e)) {
    //       throw e;
    //     }
    //   }
    // });

    const poller = (_: any, kind: number) => {
      const stats = fs.lstatSync(entry.file);
      entry.stats = stats;
      try {
        switch (kind) {
          case ts.FileWatcherEventKind.Created: this.emit('added', entry); break;
          case ts.FileWatcherEventKind.Changed: this.emit('changed', entry); break;
          case ts.FileWatcherEventKind.Deleted: this.emit('removed', entry); break;
        }
      } catch (err) {
        console.warn('Error in watching', { file: entry.file });
      }
    };

    this.files.set(entry.file, ts.sys.watchFile!(entry.file, poller, opts.interval, opts));
    // this.files.set(entry.file, { close: () => fs.unwatchFile(entry.file, poller) });
    // fs.watchFile(entry.file, opts, poller);
  }

  /**
   * Stop watching a file
   */
  private unwatchFile(entry: ScanEntry) {
    if (this.files.has(entry.file)) {
      console.debug('Unwatching File', { file: entry.file });

      this.files.get(entry.file)!.close();
      this.files.delete(entry.file);
    }
  }

  /**
   * Stop watching a directory
   */
  private unwatchDirectory(entry: ScanEntry) {
    if (this.directories.has(entry.file)) {
      console.debug('Unwatching Directory', { directory: entry.file });

      for (const child of (entry.children ?? [])) {
        this.unwatch(child.file);
      }

      this.directories.get(entry.file)!.close();
      this.directories.delete(entry.file);
    }
  }

  /**
   * Watch an entry, could be a file or a folder
   */
  private watch(...entries: ScanEntry[]) {
    for (const entry of entries.filter(x => !this.watched.has(x.file))) {
      this.watched.set(entry.file, entry);

      if (ScanFs.isDir(entry)) { // Watch Directory
        this.watchDirectory(entry);
      } else { // Watch File
        this.watchFile(entry);
      }
    }
    return this;
  }

  /**
   * Unwatch a path
   */
  private unwatch(...files: string[]) {
    for (const file of files.filter(x => this.watched.has(x))) {
      const entry = this.watched.get(file)!;
      if (!entry) {
        return;
      }
      this.watched.delete(file);

      if (ScanFs.isDir(entry)) {
        this.unwatchDirectory(entry);
      } else {
        this.unwatchFile(entry);
      }
    }
    return this;
  }

  /**
   * Handle watch error
   */
  private handleError(err: Error & { code?: string }) {
    switch (err.code) {
      case 'EMFILE': this.emit('error', new Error('EMFILE: Too many opened files.')); break;
      case 'ENOENT': return false;
      default: this.emit('error', err);
    }
    return true;
  }

  /**
   * Emit change to file
   */
  emit(type: string, payload?: any) {
    if (!this.suppress) {
      console.debug('Watch Event', { type, file: payload?.file.replace(FsUtil.cwd, '.') });
      if (type !== 'error' && type !== 'end') {
        super.emit('all', { event: type, entry: payload });
      }
      super.emit(type, payload);
    }
    return true;
  }

  /**
   * Close the watcher, releasing all the file system pollers
   */
  close() {
    this.unwatch(...this.watched.keys());

    setImmediate(() => {
      this.emit('end');
      this.removeAllListeners();
    });
    return this;
  }
}