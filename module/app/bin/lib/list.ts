import * as util from 'util';
import * as fs from 'fs';
import { parentPort } from 'worker_threads';

import { CliUtil } from '@travetto/cli/src/util';
import { AppCache } from '@travetto/boot/src/app-cache';
import { FsUtil } from '@travetto/boot/src/fs';
import { ExecUtil } from '@travetto/boot/src/exec';

import type { ApplicationConfig } from '../../src/types';

/**
 * Utilities to fetch list of applications
 */
export class AppListManager {

  private static fsLstat = util.promisify(fs.lstat);
  private static cacheConfig = 'app-cache.json';

  static getRoots() {
    // Initialize up to compiler
    const roots = ['.'];
    try {
      roots.push(...fs.readdirSync(FsUtil.resolveUnix(FsUtil.cwd, 'alt')).map(x => `alt/${x}`));
    } catch { }
    return roots;
  }

  /**
   * Compile code, and look for `@Application` annotations
   */
  static async buildList() {
    if (!parentPort) { // If top level, recurse
      return CliUtil.waiting('Compiling', () =>
        ExecUtil.worker<ApplicationConfig[]>(FsUtil.resolveUnix(__dirname, '../travetto-plugin-list'), ['build'])
          .message
      );
    } else {
      const { PhaseManager } = await import('@travetto/base');
      await PhaseManager.init('compile-all'); // Compilation is pre done

      const { AppListUtil } = await import('../../src/list');
      const list = await AppListUtil.buildList();
      return list.map(({ target, ...rest }) => rest);
    }
  }

  /**
   * Find application by given name
   * @param name
   */
  static async findByName(name: string) {
    return (await this.getList())?.find(x => x.name === name);
  }


  /**
   * Store list of cached items
   * @param items
   */
  static storeList(items: ApplicationConfig[]) {
    const toStore = items.map(x => ({ ...x, target: undefined }));
    AppCache.writeEntry(this.cacheConfig, JSON.stringify(toStore));
  }

  /**
   * Request list of applications
   */
  static async verifyList(items: ApplicationConfig[]): Promise<ApplicationConfig[]> {
    try {
      for (const el of items) {
        const elStat = (await this.fsLstat(el.filename).catch(e => { delete el.generatedTime; }));
        // invalidate cache if changed
        if (elStat && (!el.generatedTime || FsUtil.maxTime(elStat) > el.generatedTime)) {
          throw new Error('Expired entry, data is stale');
        }
      }
      return items;
    } catch (e) {
      AppCache.removeExpiredEntry(this.cacheConfig, true);
      throw e;
    }
  }

  /**
   * Read list
   */
  static async readList(): Promise<ApplicationConfig[] | undefined> {
    if (AppCache.hasEntry(this.cacheConfig)) {
      return JSON.parse(AppCache.readEntry(this.cacheConfig)) as ApplicationConfig[];
    }
  }

  /**
   * Request list of applications
   */
  static async getList(): Promise<ApplicationConfig[] | undefined> {
    if (!(await this.readList())) { // no list
      this.storeList(await this.buildList());
    }

    const items = await this.readList();
    if (items) {
      try {
        await this.verifyList(items);
      } catch (e) {
        if (e.message.includes('Expired')) {
          return await this.getList();
        } else {
          throw e;
        }
      }
    }
    return items;
  }

  /**
   * Handles plugin response
   */
  static async run(mode?: string) {
    CliUtil.initAppEnv({ roots: this.getRoots() });

    let list: ApplicationConfig[];
    if (mode === 'build') {
      list = await this.buildList();
    } else {
      list = await this.getList() ?? [];
    }
    CliUtil.pluginResponse(list);
  }
}
