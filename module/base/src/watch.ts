import * as util from 'util';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { Entry, Handler, bulkFindSync } from './scan-fs';
import { throttle } from '.';

interface Options {
  maxListeners?: number;
  interval: number;
  debounceDelay: number;
  cwd: string;
}

export class Watcher extends EventEmitter {

  private watched = new Map<string, Entry>();
  private watchers = new Map<string, fs.FSWatcher>();
  private pollers = new Map<string, (curr: fs.Stats, prev: fs.Stats) => void>();
  private findHandlers: Handler[] = [];
  private cached = new Map<string, (string | symbol)[]>();
  private pendingWatched: Entry[] = [];
  private pending = true;
  private suppress = false;

  private options: Options;

  constructor(opts: Partial<Options> = {}) {
    super();

    this.options = {
      maxListeners: opts.maxListeners,
      interval: opts.interval || 250,
      debounceDelay: opts.debounceDelay || 250,
      cwd: opts.cwd || process.cwd()
    };

    // Set maxListeners
    if (this.options.maxListeners != null) {
      this.setMaxListeners(this.options.maxListeners);
      super.setMaxListeners(this.options.maxListeners);
    }

    this.pendingWatched.push({
      file: this.options.cwd,
      stats: fs.lstatSync(this.options.cwd)
    });
  }

  handleError(err: Error & { code?: string }) {
    if (err.code === 'EMFILE') {
      this._emit('error', new Error('EMFILE: Too many opened files.'));
    }
    this._emit('error', err);
  }

  close() {
    for (const [k, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers = new Map();

    for (const dir of this.watched.keys()) {
      this.unwatch(dir);
    }

    this.watched = new Map();

    setImmediate(() => {
      this._emit('end');
      this.removeAllListeners();
    });
  };

  add(handlers: (string | Handler)[]) {
    const finalHandlers = handlers.map(x => {
      return typeof x === 'string' ? { testFile: (rel: string) => rel === x } : x;
    });
    this.findHandlers = this.findHandlers.concat(finalHandlers);

    for (const entry of bulkFindSync(finalHandlers, this.options.cwd)) {
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
    this.pending = false
    if (this.pendingWatched.length) {
      this.suppress = !listenInitial;
      this.pendingWatched.map(x => this.watch(x));
      this.pendingWatched = [];
      setImmediate(() => this.suppress = false);
    }
  }

  watch(entry: Entry) {
    if (this.watched.has(entry.file)) {
      return;
    }

    this.watched.set(entry.file, entry);

    if (entry.stats.isDirectory()) { // Watch Directory
      this.watchDirectory(entry);
    } else { // Watch File
      this.watchFile(entry);
    }
  }

  private processDirectoryChange(dir: Entry) {
    dir.children = dir.children || [];

    fs.readdir(dir.file, (err, current) => {
      if (err) {
        if (err.code === 'ENOENT') {
          current = [];
        } else {
          return this._emit('error', err);
        }
      }

      // Convert to full paths
      current = current.map(x => `${dir.file}${path.sep}${x}`);

      // Get watched files for this dir
      const previous = (dir.children || []).slice(0);

      // If file was deleted
      for (const child of previous) {
        if (current.indexOf(child.file) < 0) {

          // Remove from watching
          this.unwatch(child.file);
          dir.children!.splice(dir.children!.indexOf(child), 1);

          if (!child.stats.isDirectory()) {
            this._emit('removed', child);
            this._emit('all', { event: 'removed', entry: child })
          }
        }
      }

      const prevSet = new Set(previous.map(x => x.file));

      // If file was added
      for (const next of current) {
        const nextRel = next.replace(this.options.cwd, '');
        const nextStats = fs.lstatSync(next);

        if (!prevSet.has(next) && (nextStats.isDirectory() ||
          this.findHandlers.find(x => x.testFile ? x.testFile(nextRel) : false))) {
          const sub: Entry = {
            file: next,
            stats: nextStats
          }
          this.watch(sub);
          dir.children!.push(sub);

          if (!sub.stats.isDirectory()) {
            this._emit('added', sub);
            this._emit('all', { event: 'added', entry: sub })
          }
        }
      }
    });
  }

  private _emit(type: string, payload?: any) {
    if (!this.suppress) {
      console.debug('Watch Event', type, payload)
      this.emit(type, payload);
    }
  }

  private watchDirectory(entry: Entry) {
    if (!entry.stats.isDirectory()) {
      throw new Error(`Not a directory: ${entry.file}`);
    }

    try {
      console.debug('Watching Directory', entry.file);
      const watcher = fs.watch(entry.file, throttle((event, f) => {
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

  private watchFile(entry: Entry) {
    if (entry.stats.isDirectory()) {
      throw new Error(`Not a file: ${entry.file}`);
    }

    console.debug('Watching File', entry.file);

    const opts = { persistent: true, interval: this.options.interval };

    this.pollers.set(entry.file, (curr: fs.Stats, prev: fs.Stats) => {
      // Only emit changed if the file still exists
      // Prevents changed/deleted duplicate events
      if (fs.existsSync(entry.file)) {
        this._emit('changed', entry);
        this._emit('all', { event: 'changed', entry })
      }
    });

    try {
      fs.watchFile(entry.file, opts, this.pollers.get(entry.file)!);
    } catch (err) {
      return this.handleError(err);
    }
  }

  private unwatchFile(entry: Entry) {
    if (this.pollers.has(entry.file)) {
      console.debug('Unwatching File', entry.file);

      fs.unwatchFile(entry.file, this.pollers.get(entry.file)!);
      this.pollers.delete(entry.file);
    }
  }

  private unwatchDirectory(entry: Entry) {
    if (this.watchers.has(entry.file)) {
      console.debug('Unwatching Directory', entry.file);

      for (const child of (entry.children || [])) {
        this.unwatch(child.file);
      }

      const watcher = this.watchers.get(entry.file)!;
      watcher.close();
      this.watchers.delete(entry.file);
    }
  }

  unwatch(file: string) {
    if (!this.watched.has(file)) {
      return;
    }
    const entry = this.watched.get(file)!;
    this.watched.delete(file);

    if (entry.stats.isDirectory()) {
      this.unwatchDirectory(entry);
    } else {
      this.unwatchFile(entry);
    }
  }
}