import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { AppCache } from '@travetto/boot/src/app-cache';
import { FsUtil } from '@travetto/boot/src/fs';
import { ExecUtil } from '@travetto/boot/src/exec';
import type { CachedAppConfig } from '../../src/types';

/**
 * Utilities to fetch list of applications
 */
export class AppListManager {

  private static fsLstat = util.promisify(fs.lstat);
  private static cacheConfig = 'app-cache.json';

  /**
   * Compile code, and look for `@Application` annotations
   */
  static async findAll() {
    // Initialize up to compiler
    const paths = ['.'];
    try {
      paths.push(
        ...fs.readdirSync(FsUtil.resolveUnix(FsUtil.cwd, 'alt')).map(x => `alt/${x}`)
      );
    } catch { }

    process.env.TRV_APP_ROOTS = paths.join(',');
    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.init('compile-all');

    const { AppListUtil } = await import('../../src/list');
    return AppListUtil.buildList();
  }

  static async findByName(name: string) {
    return (await this.getList())?.find(x => x.name === name);
  }


  /**
   * Store list of cached items
   * @param items
   */
  static storeList(items: CachedAppConfig[]) {
    AppCache.writeEntry(this.cacheConfig, JSON.stringify(items));
  }

  /**
   * Request list of applications
   */
  static async verifyList(items: CachedAppConfig[]): Promise<CachedAppConfig[]> {
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
  static async readList(): Promise<CachedAppConfig[] | undefined> {
    if (AppCache.hasEntry(this.cacheConfig)) {
      return JSON.parse(AppCache.readEntry(this.cacheConfig)) as CachedAppConfig[];
    }
  }

  /**
   * Request list of applications
   */
  static async getList(): Promise<CachedAppConfig[] | undefined> {
    if (!(await this.readList())) { // no list
      const text = (await ExecUtil.fork(path.resolve(__dirname, '..', 'find-apps'), [], {
        env: {
          DEBUG: '0',
          TRACE: '0'
        }
      }).result).stdout;
      this.storeList(JSON.parse(text) as CachedAppConfig[]);
    }

    const items = await this.readList();
    if (items) {
      try {
        await this.verifyList(items);
      } catch (e) {
        if (e.message.includes('expired')) {
          return await this.getList();
        } else {
          throw e;
        }
      }
    }
    return items;
  }
}
