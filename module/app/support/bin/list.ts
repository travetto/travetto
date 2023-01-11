import fs from 'fs/promises';
import { parentPort } from 'worker_threads';

import { path, RootIndex } from '@travetto/manifest';
import { ExecUtil } from '@travetto/base';

import { AppScanUtil } from '../../src/scan';
import type { ApplicationConfig } from '../../src/types';

/**
 * Utilities to fetch list of applications
 */
export class AppListLoader {

  #cacheConfig: string;

  constructor(cacheConfig: string = path.resolve(RootIndex.mainModule.output, 'trv-app-cache.json')) {
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
    try {
      if (parentPort) { // If top level, recurse
        return AppScanUtil.expandByDependents(await AppScanUtil.scanList())
          .map(({ target, ...rest }) => rest);
      } else {
        return await (ExecUtil.worker<ApplicationConfig[]>(
          RootIndex.resolveFileImport('@travetto/app/support/main.list-build.ts')
        ).message);
      }
    } catch (err) {
      return [];
    }
  }

  /**
   * Find application by given name
   * @param name
   */
  async findByName(name: string): Promise<ApplicationConfig | undefined> {
    return (await this.getList())?.find(x => x.globalName === name || x.name === name);
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