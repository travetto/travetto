import * as fs from 'fs/promises';
import { parentPort } from 'worker_threads';

import { FsUtil, AppCache, CliUtil } from '@travetto/boot';
import { ModuleExec } from '@travetto/boot/src/internal/module-exec';

import type { ApplicationConfig } from '../../src/types';

/**
 * Utilities to fetch list of applications
 */
export class AppListUtil {

  static #cacheConfig = 'app-cache.json';

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
      AppCache.removeEntry(this.#cacheConfig, true);
      throw err;
    }
  }

  /**
   * Compile code, and look for `@Application` annotations
   */
  static async buildList(): Promise<ApplicationConfig[]> {
    if (!parentPort) { // If top level, recurse
      return CliUtil.waiting('Collecting', () =>
        ModuleExec.workerMain<ApplicationConfig[]>(require.resolve('../main.list-build')).message
      );
    } else {
      await (await import('@travetto/base/support/main.build')).main();

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
      if (items) {
        this.#storeList(items);
      }
    }

    if (items) {
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