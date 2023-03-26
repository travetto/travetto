import { Stats, watchFile, unwatchFile, rmSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import fs from 'fs/promises';
import { Worker } from 'worker_threads';
import path from 'path';

import type { ManifestContext } from '@travetto/manifest';

import { CompilerLogger, LogUtil } from './log';

type LockStatus = 'complete' | 'stale';
type LockDetails = {
  pid: number | undefined;
  file: string;
};

export type LockType = 'build' | 'watch';
export type LockCompileAction = 'skip' | 'build';
type LockAction = LockCompileAction | 'retry';

const STALE_THRESHOLD = 1000;

/**
 * Manager for all lock activity
 */
export class LockManager {

  /**
   * Get the lock file name
   */
  static #getFileName(ctx: ManifestContext, type: LockType): string {
    return path.resolve(ctx.workspacePath, ctx.toolFolder, `${type}.lock`);
  }

  /**
   * Determine if the given stats are stale for modification time
   */
  static #isStale(stat?: Stats): boolean {
    return !!stat && stat.mtimeMs < (Date.now() - STALE_THRESHOLD * 1.1);
  }

  /**
   * Get the lock file details
   */
  static async #getDetails(ctx: ManifestContext, type: LockType): Promise<LockDetails> {
    const file = this.#getFileName(ctx, type);
    const stat = await fs.stat(file).catch(() => undefined);
    const stale = this.#isStale(stat);
    let pid: number | undefined;
    if (stat) {
      const { pid: filePid } = JSON.parse(await fs.readFile(file, 'utf8'));
      if (stale) {
        LogUtil.log('lock', [], 'debug', `${type} file is stale: ${stat.mtimeMs} vs ${Date.now()}`);
      } else {
        pid = filePid;
      }
    }
    return { pid, file };
  }

  /**
   * Acquire the lock file, and register a cleanup on exit
   */
  static #acquireFile(ctx: ManifestContext, type: LockType): void {
    const file = this.#getFileName(ctx, type);
    mkdirSync(path.dirname(file), { recursive: true });
    LogUtil.log('lock', [], 'debug', `Acquiring ${type}`);
    writeFileSync(file, JSON.stringify({ pid: process.pid }), 'utf8');
  }

  /**
   * Release the lock file (i.e. deleting)
   */
  static #releaseFile(ctx: ManifestContext, type: LockType): void {
    const file = this.#getFileName(ctx, type);
    if (existsSync(file)) {
      rmSync(file, { force: true });
      LogUtil.log('lock', [], 'debug', `Releasing ${type}`);
    }
  }

  /**
   * Wait until a lock file is released, or it becomes stale
   */
  static async #waitForRelease(ctx: ManifestContext, type: LockType): Promise<LockStatus> {
    const file = this.#getFileName(ctx, type);
    let remove: (() => void) | undefined = undefined;

    const prom = new Promise<LockStatus>(resolve => {
      let timer: NodeJS.Timeout | undefined = undefined;
      const handler = async (): Promise<void> => {
        if (timer) {
          clearTimeout(timer);
        }
        const stats = await fs.stat(file).catch(() => undefined);
        if (!stats) {
          resolve('complete');
        } else if (this.#isStale(stats)) {
          resolve('stale');
        } else {
          timer = setTimeout(handler, STALE_THRESHOLD * 1.1);
        }
      };

      watchFile(file, handler);
      handler();

      remove = (): void => {
        clearTimeout(timer);
        unwatchFile(file, handler);
      };
    });

    return prom.finally(remove);
  }

  /**
   * Read the watch lock file and determine its result, communicating with the user as necessary
   */
  static async #getWatchAction(ctx: ManifestContext, log: CompilerLogger, lockType: LockType | undefined, buildState: LockDetails): Promise<LockAction> {
    if (lockType === 'watch') {
      log('info', 'Already running');
      return 'skip';
    } else {
      if (buildState.pid) {
        log('warn', 'Already running, waiting for build to finish');
        switch (await this.#waitForRelease(ctx, 'build')) {
          case 'complete': {
            log('info', 'Completed build');
            return 'skip';
          }
          case 'stale': {
            log('info', 'Became stale, retrying');
            return 'retry';
          }
        }
      } else {
        log('info', 'Already running, and has built');
        return 'skip';
      }
    }
  }

  /**
   * Read the build lock file and determine its result, communicating with the user as necessary
   */
  static async #getBuildAction(ctx: ManifestContext, log: CompilerLogger, lockType: LockType | undefined): Promise<LockAction> {
    if (lockType === 'watch') {
      log('warn', 'Build already running, waiting to begin watch');
      const res = await this.#waitForRelease(ctx, 'build');
      log('info', `Finished with status of ${res}, retrying`);
      return 'retry';
    } else {
      log('warn', 'Already running, waiting for completion');
      switch (await this.#waitForRelease(ctx, lockType ?? 'build')) {
        case 'complete': {
          log('info', 'Completed');
          return 'skip';
        }
        case 'stale': {
          log('info', 'Became stale, retrying');
          return 'retry';
        }
      }
    }
  }

  /**
   * Run code with support for lock acquire and release
   */
  static async withLocks(ctx: ManifestContext, fn: (acquire: (type: LockType) => void, release: (type: LockType) => void) => Promise<unknown>): Promise<void> {
    const activeLockTypes = new Set<LockType>();

    const pinger = path.resolve(ctx.workspacePath, ctx.compilerFolder, 'node_modules', '@travetto/compiler/support/lock-pinger.js');
    const worker = new Worker(pinger, {
      workerData: {
        interval: STALE_THRESHOLD,
        files: []
      }
    });

    const notify = (): void => worker.postMessage({ files: [...activeLockTypes].map(t => this.#getFileName(ctx, t)) });

    const stop = (): void => {
      worker.postMessage('stop');
      for (const type of activeLockTypes) {
        this.#releaseFile(ctx, type);
      }
      worker.terminate().then(() => { });
    };

    process.on('SIGINT', stop);
    process.on('exit', stop);

    try {
      await new Promise(r => worker.on('online', r));
      await fn(
        type => {
          if (!activeLockTypes.has(type)) {
            activeLockTypes.add(type);
            this.#acquireFile(ctx, type);
            notify();
          }
        },
        type => {
          if (activeLockTypes.has(type)) {
            activeLockTypes.delete(type);
            this.#releaseFile(ctx, type);
            notify();
          }
        }
      );
    } finally {
      stop();
    }
  }

  /**
   * Reads the lock file states (build + watch) to determine what action should be taken for the compiler
   */
  static async getCompileAction(ctx: ManifestContext, lockType: LockType | undefined): Promise<LockCompileAction> {
    let result: LockAction;
    do {
      result = 'build';
      const buildState = await this.#getDetails(ctx, 'build');
      const watchState = await this.#getDetails(ctx, 'watch');
      if (watchState.pid) { // Existing watch operation
        result = await LogUtil.withLogger('lock', log => this.#getWatchAction(ctx, log, lockType, buildState), true, ['watch', `pid=${watchState.pid}`]);
      } else if (buildState.pid) { // Existing build operation
        result = await LogUtil.withLogger('lock', log => this.#getBuildAction(ctx, log, lockType), true, ['build', `pid=${buildState.pid}`]);
      }
    } while (result === 'retry');
    return result;
  }
}