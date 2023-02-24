import { Stats, watchFile, unwatchFile, existsSync } from 'fs';
import fs from 'fs/promises';
import timers from 'timers/promises';
import vscode from 'vscode';
import { EventEmitter } from 'stream';

import { path } from '@travetto/manifest';

import { Workspace } from './workspace';
import { Log } from './log';

const STALE_THRESHOLD = 1000;

type MProm<T> = Promise<T> & { resolve: (val: T) => void, reject: (err?: Error) => void };
type LockState = 'missing' | 'stale' | 'valid';
type CProm = Promise<LockState> & { cleanup: () => void };

const manualPromise = <T>(): MProm<T> => {
  let ops: Pick<MProm<T>, 'reject' | 'resolve'>;
  const prom = new Promise<T>((resolve, reject) => ops = { resolve, reject });
  return Object.assign(prom, ops!);
};

export class BuildStatus {
  /**
   * Determine if the given stats are stale for modification time
   */
  static #isStale(stat?: Stats): boolean {
    return !!stat && stat.mtimeMs < (Date.now() - STALE_THRESHOLD * 1.1);
  }

  static #item: vscode.StatusBarItem;
  static #emitter = new EventEmitter();
  static #log = new Log('travetto.build-status');

  /**
   * Wait until a lock file is released, or it becomes stale
   */
  static #waitUntilFile(file: string, until: (ev: LockState) => boolean, interval?: number): CProm {
    let timer: NodeJS.Timeout | undefined;
    let registered = existsSync(file);

    const prom = manualPromise<LockState>();

    const handler = async (): Promise<void> => {
      if (timer) {
        clearTimeout(timer);
      }
      const res = await fs.stat(file).catch(() => undefined);
      if (res && !registered) {
        watchFile(file, handler);
        registered = true;
      }
      const state = !res ? 'missing' : (BuildStatus.#isStale(res) ? 'stale' : 'valid');
      if (until(state)) {
        prom.resolve(state);
      }
      timer = setTimeout(handler, (interval ?? STALE_THRESHOLD) * 1.1);
    };

    if (registered) {
      watchFile(file, handler);
    } else {
      handler();
    }

    const cleanup = (): void => {
      timer && clearTimeout(timer);
      registered && unwatchFile(file, handler);
    };

    return Object.assign(prom.finally(cleanup), { cleanup });
  }

  static #waitForRelease(file: string, interval?: number): CProm {
    this.#log.info(`Waiting for release ${file}`);
    return this.#waitUntilFile(file, ev => ev !== 'valid', interval);
  }

  static #waitForAcquire(file: string, interval?: number): CProm {
    this.#log.info(`Waiting for acquire ${file}`);
    return this.#waitUntilFile(file, ev => ev === 'valid', interval);
  }

  static async init(ctx: vscode.ExtensionContext): Promise<void> {
    this.#item = vscode.window.createStatusBarItem('travetto.build', vscode.StatusBarAlignment.Left, 1000);
    this.#item.text = 'Initializing...';
    this.#item.show();
    vscode.commands.registerCommand('travetto.show-log', () => this.#log.show());
    this.#item.command = { command: 'travetto.show-log', title: 'Show Logs' };
  }

  static onBuildReady(handler: Function): void {
    this.#emitter.on('build-ready', () => handler());
  }

  static onBuildWaiting(handler: Function): void {
    this.#emitter.on('build-waiting', () => handler());
  }

  static async listenForChanges(): Promise<void> {
    const watchLockFile = Workspace.resolveToolFile('watch.lock');
    const buildLockFile = Workspace.resolveToolFile('build.lock');

    for (; ;) {
      await fs.mkdir(path.dirname(watchLockFile), { recursive: true });

      const watchStat = await fs.stat(watchLockFile).catch(() => undefined);
      const buildStat = await fs.stat(buildLockFile).catch(() => undefined);

      if ( // Are we actively compiling
        watchStat && !BuildStatus.#isStale(watchStat) &&
        buildStat && !BuildStatus.#isStale(buildStat)
      ) {
        this.#item.text = 'Compiling...';
        // Wait until build is finished
        if (await this.#waitForRelease(buildLockFile) === 'stale') { // If we failed at building
          await timers.setTimeout(250); // Wait a quarter second and retry
          continue;
        }
      } else if (!watchStat || BuildStatus.#isStale(watchStat)) {
        // No one is watching, wait for build
        this.#log.info('Waiting for build');
        this.#item.text = 'Building...';
        this.#emitter.emit('build-waiting');
        // Ensure we build after we emit
        await this.#waitForAcquire(buildLockFile);
        await this.#waitForRelease(buildLockFile);
      }

      // Code is ready!
      this.#item.text = 'Code Ready';
      this.#log.info('Build is ready');
      this.#emitter.emit('build-ready');
      // Wait until a new build is started, or the watch process gives up the lock file
      const build = this.#waitForAcquire(buildLockFile);
      const watch = this.#waitForRelease(watchLockFile, 5000);
      await Promise.race([build, watch]);

      // Cleanup, and retry
      build.cleanup();
      watch.cleanup();
    }
  }
}