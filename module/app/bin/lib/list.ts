import * as fs from 'fs/promises';
import { parentPort } from 'worker_threads';

import { EnvUtil } from '@travetto/boot/src/env';
import { FsUtil } from '@travetto/boot/src/fs';
import { AppCache } from '@travetto/boot/src/cache';
import { ExecUtil } from '@travetto/boot/src/exec';
import { CliUtil } from '@travetto/cli/src/util';
import { SystemUtil } from '@travetto/boot/src/internal/system';

import type { ApplicationConfig } from '../../src/types';

/**
 * Utilities to fetch list of applications
 */
export class AppListUtil {

  static #cacheConfig = `app-cache-${SystemUtil.naiveHash(EnvUtil.get('TRV_SRC_LOCAL', ''))}.json`;

  /**
   * Read list
   */
  static async #readList(): Promise<ApplicationConfig[] | undefined> {
    if (AppCache.hasEntry(this.#cacheConfig)) {
      return JSON.parse(AppCache.readEntry(this.#cacheConfig));
    }
  }

  /**
   * Store list of cached items
   * @param items
   */
  static #storeList(items: ApplicationConfig[]): void {
    const toStore = items.map(x => ({ ...x, target: undefined }));
    AppCache.writeEntry(this.#cacheConfig, JSON.stringify(toStore));
  }

  /**
   * Request list of applications
   */
  static async #verifyList(items: ApplicationConfig[]): Promise<ApplicationConfig[]> {
    try {
      for (const el of items) {
        const elStat = (await fs.lstat(el.filename).catch(() => { delete el.generatedTime; }));
        // invalidate cache if changed
        if (elStat && (!el.generatedTime || FsUtil.maxTime(elStat) > el.generatedTime)) {
          throw new Error('Expired entry, data is stale');
        }
      }
      return items;
    } catch (err) {
      AppCache.removeExpiredEntry(this.#cacheConfig, true);
      throw err;
    }
  }

  /**
   * Compile code, and look for `@Application` annotations
   */
  static async buildList(): Promise<ApplicationConfig[]> {
    if (!parentPort) { // If top level, recurse
      return CliUtil.waiting('Collecting', () =>
        ExecUtil.workerMain<ApplicationConfig[]>(require.resolve('../list-build')).message
      );
    } else {
      await (await import('@travetto/base/bin/build')).main();

      const { AppScanUtil } = await import('../../src/scan');
      const list = await AppScanUtil.scanList();
      return list.map(({ target, ...rest }) => rest);
    }
  }

  /**
   * Find application by given name
   * @param name
   */
  static async findByName(name: string): Promise<ApplicationConfig | undefined> {
    return (await this.getList())?.find(x => x.name === name);
  }

  /**
   * Request list of applications
   */
  static async getList(): Promise<ApplicationConfig[] | undefined> {
    let items: ApplicationConfig[] | undefined;
    if (!(items = await this.#readList())) { // no list
      items = await this.buildList();
      if (items && !EnvUtil.isReadonly()) {
        this.#storeList(items);
      }
    }

    if (items && !EnvUtil.isReadonly()) {
      try {
        await this.#verifyList(items);
      } catch (err) {
        if (err && err instanceof Error && err.message.includes('Expired')) {
          return await this.getList();
        } else {
          throw err;
        }
      }
    }
    return items;
  }
}