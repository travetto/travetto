import * as path from 'path';
import { ExecUtil } from '@travetto/boot/src/exec';
import { CachedAppConfig } from '../../src/types';
import { handleFailure } from './util';

/**
 * Utilities to fetch list of applications
 */
export class FindUtil {

  /**
   * Compile code, and look for `@Application` annotations
   */
  static async discover() {
    // Initialize up to compiler
    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.init('compile-all');

    const { AppListUtil } = await import('../../src/list');
    return AppListUtil.scanForApps();
  }

  static async getByName(name: string) {
    return (await this.getList())?.find(x => x.name === name);
  }

  /**
   * Request list of applications
   */
  static async getList(): Promise<CachedAppConfig[] | undefined> {
    const { AppListUtil } = await import('../../src/list');

    if (AppListUtil.readList() === null) { // no list
      const text = (await ExecUtil.fork(path.resolve(__dirname, '..', 'find-apps'), [], {
        env: {
          DEBUG: '0',
          TRACE: '0'
        }
      }).result).stdout;
      await AppListUtil.storeList(JSON.parse(text) as CachedAppConfig[]);
    }

    const items = AppListUtil.readList();
    if (items) {
      try {
        await AppListUtil.verifyList(items);
      } catch (e) {
        if (e.message.includes('expired')) {
          return await this.getList();
        } else {
          throw e;
        }
      }
    }
  }

  /**
   * Run discover code and return as JSON
   */
  static async discoverAsJson() {
    try {
      console.log(this.discover());
    } catch (err) {
      handleFailure(err, 1);
      throw err;
    }
  }
}
