import * as util from 'util';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { Entry, Handler, bulkFindSync, scanDirSync } from './bulk-find';

// globals
const delay = 10;

type Callback<T = any> = (err: Error | undefined, res?: T) => any;

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

  private options: Options;

  constructor(opts: Partial<Options> = {}) {
    super();

    this.options = {
      maxListeners: opts.maxListeners,
      interval: opts.interval || 100,
      debounceDelay: opts.debounceDelay || 500,
      cwd: opts.cwd || process.cwd()
    };

    // Set maxListeners
    if (this.options.maxListeners != null) {
      this.setMaxListeners(this.options.maxListeners);
      super.setMaxListeners(this.options.maxListeners);
    }

    setImmediate(() => {
      this.watch({
        full: this.options.cwd,
        relative: '',
        stats: fs.lstatSync(this.options.cwd)
      });
    });

    debugger;
  }

  handleError(err: Error & { code?: string }) {
    if (err.code === 'EMFILE') {
      this.emit('error', new Error('EMFILE: Too many opened files.'));
    }
    this.emit('error', err);
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

    setTimeout(() => {
      this.emit('end');
      this.removeAllListeners();
    }, delay + 100);
  };

  add(handlers: (string | Handler)[]) {
    this.findHandlers = this.findHandlers.concat(handlers.map(x => {
      return typeof x === 'string' ? { test: (rel: string) => rel === x } : x;
    }));

    for (const entry of bulkFindSync(this.findHandlers, this.options.cwd)) {
      if (!this.watched.has(entry.full)) {
        this.watch(entry);
      }
    }
  }

  watch(entry: Entry) {
    if (this.watched.has(entry.full)) {
      return;
    }

    this.watched.set(entry.full, entry);

    if (entry.stats.isDirectory()) { // Watch Directory
      this.watchDirectory(entry);
    } else { // Watch File
      this.watchFile(entry);
    }
  }

  private processDirectoryChange(dir: Entry) {
    dir.children = dir.children || [];

    fs.readdir(dir.full, (err, current) => {
      if (err) {
        if (err.code === 'ENOENT') {
          current = [];
        } else {
          return this.emit('error', err);
        }
      }

      // Convert to full paths
      current = current.map(x => `${dir.full}${path.sep}${x}`);

      // Get watched files for this dir
      const previous = (dir.children || []).slice(0);

      // If file was deleted
      for (const child of previous) {
        if (current.indexOf(child.full) < 0) {

          // Remove from watching
          this.unwatch(child.full);
          dir.children!.splice(dir.children!.indexOf(child));

          if (!child.stats.isDirectory()) {
            this.emit('deleted', child);
            this.emit('all', { event: 'deleted', entry: child })
          }
        }
      }

      // If file was added
      for (const next of current) {
        const nextRel = next.replace(`${this.options.cwd}${path.sep}`, '');
        if (!previous.find(p => p.full === next) && this.findHandlers.find(x => x.test(nextRel))) {
          const sub: Entry = {
            full: next,
            relative: nextRel,
            stats: fs.lstatSync(next)
          }
          this.watch(sub);
          dir.children!.push(sub);

          if (!sub.stats.isDirectory()) {
            this.emit('added', sub);
            this.emit('all', { event: 'added', entry: sub })
          }
        }
      }
    });
  }

  private watchDirectory(entry: Entry) {
    if (!entry.stats.isDirectory()) {
      throw new Error(`Not a directory: ${entry.full}`);
    }

    try {
      console.log('Watching', entry.full);
      const watcher = fs.watch(entry.full, (event, f) => {
        this.processDirectoryChange(entry);
      });

      // Load any sub folders
      for (const dir of bulkFindSync(this.findHandlers, entry.full)) {
        if (dir.stats.isDirectory()) {
          this.watch(dir);
        }
      }


      watcher.on('error', (err) => {
        this.handleError(err);
      });

      this.watchers.set(entry.full, watcher);
    } catch (err) {
      return this.handleError(err);
    }
  }

  private watchFile(entry: Entry) {
    if (entry.stats.isDirectory()) {
      throw new Error(`Not a file: ${entry.full}`);
    }

    const opts = { persistent: true, interval: this.options.interval };

    this.pollers.set(entry.full, (curr: fs.Stats, prev: fs.Stats) => {
      // Only emit changed if the file still exists
      // Prevents changed/deleted duplicate events
      if (fs.existsSync(entry.full)) {
        this.emit('changed', entry);
        this.emit('all', { event: 'changed', entry })
      }
    });

    try {
      fs.watchFile(entry.full, opts, this.pollers.get(entry.full)!);
    } catch (err) {
      return this.handleError(err);
    }
  }

  private unwatchFile(entry: Entry) {
    if (this.pollers.has(entry.full)) {
      fs.unwatchFile(entry.full, this.pollers.get(entry.full)!);
      this.pollers.delete(entry.full);
    }
  }

  private unwatchDirectory(entry: Entry) {
    console.log('Unwatching', entry.full);

    if (this.watchers.has(entry.full)) {
      for (const child of (entry.children || [])) {
        this.unwatch(child.full);
      }

      const watcher = this.watchers.get(entry.full)!;
      watcher.close();
      this.watchers.delete(entry.full);
    }
  }

  unwatch(file: string) {
    if (!this.watched.has(file)) {
      return;
    }
    const entry = this.watched.get(file)!;
    if (entry.stats.isDirectory()) {
      this.unwatchDirectory(entry);
    } else {
      this.unwatchFile(entry);
    }
  }
}