import * as path from 'path';
import * as fs from 'fs/promises';
import { parentPort } from 'worker_threads';

import { CliUtil, ExecUtil } from '@travetto/boot';

import type { ApplicationConfig } from '../../src/types';

/**
 * Utilities to fetch list of applications
 */
export class $AppListLoader {

  #cacheConfig: string;

  constructor(cacheConfig: string) {
    this.#cacheConfig = cacheConfig;
  }

  /**
   * Read list
   */
  async #readList(): Promise<ApplicationConfig[] | undefined> {
    if (await fs.stat(this.#cacheConfig).catch(() => { })) {
      return JSON.parse(await fs.readFile(this.#cacheConfig, 'utf8'));
    }
  }

  /**
   * Store list of cached items
   * @param items
   */
  async #storeList(items: ApplicationConfig[]): Promise<void> {
    const toStore = items.map(x => ({ ...x, target: undefined }));
    await fs.writeFile(this.#cacheConfig, JSON.stringify(toStore));
  }

  /**
   * Request list of applications
   */
  async #verifyList(items: ApplicationConfig[]): Promise<ApplicationConfig[]> {
    try {
      for (const el of items) {
        const elStat = (await fs.lstat(el.filename).catch(() => { delete el.generatedTime; }));
        // invalidate cache if changed
        if (elStat && (!el.generatedTime || Math.max(elStat.mtimeMs, elStat.ctimeMs) > el.generatedTime)) {
          throw new Error('Expired entry, data is stale');
        }
      }
      return items;
    } catch (err) {
      await fs.unlink(this.#cacheConfig);
      throw err;
    }
  }

  /**
   * Compile code, and look for `@Application` annotations
   */
  async buildList(): Promise<ApplicationConfig[]> {
    if (!parentPort) { // If top level, recurse
      return CliUtil.waiting('Collecting', () =>
        ExecUtil.worker<ApplicationConfig[]>(require.resolve('../main.list-build')).message
      );
    } else {
      await (await import('@travetto/boot/support/main.build')).main();

      const { AppScanUtil } = await import('../../src/scan');
      const list = await AppScanUtil.scanList();
      return list.map(({ target, ...rest }) => rest);
    }
  }

  /**
   * Find application by given name
   * @param name
   */
  async findByName(name: string): Promise<ApplicationConfig | undefined> {
    return (await this.getList())?.find(x => x.name === name);
  }

  /**
   * Request list of applications
   */
  async getList(): Promise<ApplicationConfig[] | undefined> {
    let items: ApplicationConfig[] | undefined;
    if (!(items = await this.#readList())) { // no list
      items = await this.buildList();
      if (items) {
        await this.#storeList(items);
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

export const AppListLoader = new $AppListLoader(
  path.resolve('.trv-app-cache.json').__posix
);