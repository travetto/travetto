import { EventEmitter } from 'events';
import * as fs from 'fs';
import { FsUtil } from '@travetto/boot/src/fs-util';

import { Env } from '../env';
import { ScanEntry, ScanHandler, ScanFs } from '../scan-fs';

import { SystemUtil } from '../system-util';

interface Options {
  maxListeners?: number;
  interval: number;
  debounceDelay: number;
  cwd: string;
}

export class Watcher extends EventEmitter {

  private watched = new Map<string, ScanEntry>();
  private watchers = new Map<string, fs.FSWatcher>();
  private pollers = new Map<string, (curr: fs.Stats, prev: fs.Stats) => void>();
  private findHandlers: ScanHandler[] = [];
  private pendingWatched: ScanEntry[] = [];
  private pending = true;
  private suppress = false;

  private options: Options;

  constructor(opts: Partial<Options> = {}) {
    super();

    this.options = {
      maxListeners: opts.maxListeners,
      interval: opts.interval ?? 250,
      debounceDelay: opts.debounceDelay ?? 250,
      cwd: opts.cwd ?? Env.cwd
    };

    // Set maxListeners
    if (this.options.maxListeners != null) {
      this.setMaxListeners(this.options.maxListeners);
      super.setMaxListeners(this.options.maxListeners);
    }

    this.pendingWatched.push({
      file: this.options.cwd,
      module: FsUtil.toUnix(this.options.cwd),
      stats: fs.lstatSync(this.options.cwd)
    });
  }

  private processDirectoryChange(dir: ScanEntry) {
    dir.children = dir.children ?? [];

    fs.readdir(dir.file, (err, current) => {
      if (err) {
        if (err.code === 'ENOENT') {
          current = [];
        } else {
          return this.registryEmit('error', err);
        }
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

          if (ScanFs.isNotDir(child)) {
            this.registryEmit('removed', child);
            this.registryEmit('all', { event: 'removed', entry: child });
          }
        }
      }

      const prevSet = new Set(previous.map(x => x.file));

      // If file was added
      for (const next of current) {
        const nextRel = next.replace(this.options.cwd, '');
        const nextStats = fs.lstatSync(next);

        if (!prevSet.has(next) && (nextStats.isDirectory() ||
          this.findHandlers.find(x => x.testFile?.(nextRel) ?? false))
        ) {
          const sub: ScanEntry = {
            file: next,
            module: FsUtil.toUnix(next),
            stats: nextStats
          };
          this.watch(sub);
          dir.children!.push(sub);

          if (ScanFs.isNotDir(sub)) {
            this.registryEmit('added', sub);
            this.registryEmit('all', { event: 'added', entry: sub });
          }
        }
      }
    });
  }

  private registryEmit(type: string, payload?: any) {
    if (!this.suppress) {
      console.trace('Watch Event', type, payload && payload.file);
      this.emit(type, payload);
    }
  }

  private watchDirectory(entry: ScanEntry) {
    if (ScanFs.isNotDir(entry)) {
      throw new Error(`Not a directory: ${entry.file}`);
    }

    try {
      console.trace('Watching Directory', entry.file);
      const watcher = fs.watch(entry.file, SystemUtil.throttle((event, f) => {
        this.processDirectoryChange(entry);
      }, this.options.debounceDelay));

      watcher.on('error', (err) => {
        this.handleError(err);
      });

      this.watchers.set(entry.file, watcher);

      this.processDirectoryChange(entry);

    } catch (err) {
      return this.handleError(err);
    }
  }

  private watchFile(entry: ScanEntry) {
    if (ScanFs.isDir(entry)) {
      throw new Error(`Not a file: ${entry.file}`);
    }

    const opts = { persistent: true, interval: this.options.interval };

    this.pollers.set(entry.file, (curr: fs.Stats, prev: fs.Stats) => {
      // Only emit changed if the file still exists
      // Prevents changed/deleted duplicate events
      try {
        // Get stats on file
        const stats = fs.lstatSync(entry.file);
        entry.stats = stats;

        this.registryEmit('changed', entry);
        this.registryEmit('all', { event: 'changed', entry });

      } catch (e) {
        if (e.code === 'ENOENT') {
          // Missing file, continue
        } else {
          throw e;
        }
      }
    });

    try {
      fs.watchFile(entry.file, opts, this.pollers.get(entry.file)!);
    } catch (err) {
      return this.handleError(err);
    }
  }

  private unwatchFile(entry: ScanEntry) {
    if (this.pollers.has(entry.file)) {
      console.trace('Unwatching File', entry.file);

      fs.unwatchFile(entry.file, this.pollers.get(entry.file)!);
      this.pollers.delete(entry.file);
    }
  }

  private unwatchDirectory(entry: ScanEntry) {
    if (this.watchers.has(entry.file)) {
      console.trace('Unwatching Directory', entry.file);

      for (const child of (entry.children ?? [])) {
        this.unwatch(child.file);
      }

      const watcher = this.watchers.get(entry.file)!;
      watcher.close();
      this.watchers.delete(entry.file);
    }
  }

  handleError(err: Error & { code?: string }) {
    if (err.code === 'EMFILE') {
      this.registryEmit('error', new Error('EMFILE: Too many opened files.'));
    }
    this.registryEmit('error', err);
  }

  close() {
    for (const [, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers = new Map();

    for (const dir of this.watched.keys()) {
      this.unwatch(dir);
    }

    this.watched = new Map();

    setImmediate(() => {
      this.registryEmit('end');
      this.removeAllListeners();
    });
  }

  add(handlers: (string | ScanHandler)[]) {
    const finalHandlers = handlers.map(x => {
      return typeof x === 'string' ? { testFile: (rel: string) => rel === x } : x;
    });
    this.findHandlers = this.findHandlers.concat(finalHandlers);

    for (const entry of ScanFs.bulkScanDirSync(finalHandlers, this.options.cwd)) {
      if (!this.watched.has(entry.file)) {
        if (this.pending) {
          this.pendingWatched.push(entry);
        } else {
          this.watch(entry);
        }
      }
    }
  }

  run(listenInitial = true) {
    this.pending = false;
    if (this.pendingWatched.length) {
      this.suppress = !listenInitial;
      this.pendingWatched.map(x => this.watch(x));
      this.pendingWatched = [];
      setImmediate(() => this.suppress = false);
    }
  }

  watch(entry: ScanEntry) {
    if (this.watched.has(entry.file)) {
      return;
    }

    this.watched.set(entry.file, entry);

    if (ScanFs.isDir(entry)) { // Watch Directory
      this.watchDirectory(entry);
    } else { // Watch File
      this.watchFile(entry);
    }
  }

  unwatch(file: string) {
    if (!this.watched.has(file)) {
      return;
    }
    const entry = this.watched.get(file)!;
    this.watched.delete(file);

    if (ScanFs.isDir(entry)) {
      this.unwatchDirectory(entry);
    } else {
      this.unwatchFile(entry);
    }
  }
}