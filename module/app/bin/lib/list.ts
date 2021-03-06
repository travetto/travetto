import * as fs from 'fs';
import { parentPort } from 'worker_threads';

import { EnvUtil } from '@travetto/boot/src/env';
import { FsUtil } from '@travetto/boot/src/fs';
import { AppCache } from '@travetto/boot/src/cache';
import { ExecUtil } from '@travetto/boot/src/exec';
import { CliUtil } from '@travetto/cli/src/util';
import { SystemUtil } from '@travetto/base/src/internal/system';

import type { ApplicationConfig } from '../../src/types';

/**
 * Utilities to fetch list of applications
 */
export class CliAppListUtil {

  private static CACHE_CONFIG = `app-cache-${SystemUtil.naiveHash(EnvUtil.get('TRV_SRC_LOCAL', ''))}.json`;

  /**
   * Compile code, and look for `@Application` annotations
   */
  static async buildList() {
    if (!parentPort) { // If top level, recurse
      return CliUtil.waiting('Compiling', () =>
        ExecUtil.workerEntry<ApplicationConfig[]>(__filename, ['build'], {
          env: { TRV_WATCH: '0' }
        }).message
      );
    } else {
      const { PhaseManager } = await import('@travetto/base');
      await PhaseManager.run('init', '@trv:compiler/compile'); // Compilation is pre done

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
    AppCache.writeEntry(this.CACHE_CONFIG, JSON.stringify(toStore));
  }

  /**
   * Request list of applications
   */
  static async verifyList(items: ApplicationConfig[]): Promise<ApplicationConfig[]> {
    try {
      for (const el of items) {
        const elStat = (await fs.promises.lstat(el.filename).catch(e => { delete el.generatedTime; }));
        // invalidate cache if changed
        if (elStat && (!el.generatedTime || FsUtil.maxTime(elStat) > el.generatedTime)) {
          throw new Error('Expired entry, data is stale');
        }
      }
      return items;
    } catch (e) {
      AppCache.removeExpiredEntry(this.CACHE_CONFIG, true);
      throw e;
    }
  }

  /**
   * Read list
   */
  static async readList(): Promise<ApplicationConfig[] | undefined> {
    if (AppCache.hasEntry(this.CACHE_CONFIG)) {
      return JSON.parse(AppCache.readEntry(this.CACHE_CONFIG)) as ApplicationConfig[];
    }
  }

  /**
   * Request list of applications
   */
  static async getList(): Promise<ApplicationConfig[] | undefined> {
    let items: ApplicationConfig[] | undefined;
    if (!(items = await this.readList())) { // no list
      items = await this.buildList();
      if (items && !EnvUtil.isReadonly()) {
        this.storeList(items);
      }
    }

    if (items && !EnvUtil.isReadonly()) {
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
    try {
      CliUtil.initEnv({});
      const list = mode === 'build' ? this.buildList() : this.getList();
      CliUtil.pluginResponse((await list) ?? []);
    } catch (err) {
      CliUtil.pluginResponse(err);
    }
  }
}

export function main(...args: string[]) {
  CliAppListUtil.run(...args);
}