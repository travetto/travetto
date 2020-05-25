import * as fs from 'fs';
import * as util from 'util';

import { AppCache } from '@travetto/boot/src/app-cache'; // Should not init the app, only load cache
import { FsUtil } from '@travetto/boot/src/fs';

import { CachedAppConfig, ApplicationConfig } from './types';
import { ScanApp } from '@travetto/base';
import { ApplicationRegistry } from './registry';

/**
 * Utilities to fetch list of applications
 */
export class AppListUtil {

  private static cacheConfig = 'app-cache.json';
  private static fsLstat = util.promisify(fs.lstat);

  /**
   * Find latest timestamp between creation and modification
   */
  static maxTime(stat: fs.Stats) {
    return Math.max(stat.ctimeMs, stat.mtimeMs); // Do not include atime
  }

  /**
   * Read list
   */
  static readList() {
    if (AppCache.hasEntry(this.cacheConfig)) {
      return JSON.parse(AppCache.readEntry(this.cacheConfig)) as CachedAppConfig[];
    } else {
      return null;
    }
  }

  /**
   * Determine app root from filename
   */
  static determineRootFromFile(filename: string) {
    const [, root] = filename.split(`${FsUtil.cwd}/`);
    const [first] = root.split('/');
    // If root is in node_modules or is 'src', default to local
    // * This supports apps being run from modules vs locally
    return (first === 'node_modules' || first === 'src') ? '.' : first;
  }

  /**
   * Enhance a config item to be cacheable
   */
  static async buildCacheAppConfig(x: ApplicationConfig) {
    return {
      watchable: x.watchable,
      target: null as unknown,
      description: x.description,
      params: x.params,
      appRoot: this.determineRootFromFile(x.target.__file),
      name: x.name,
      generatedTime: this.maxTime(await this.fsLstat(x.target.__file)),
      filename: x.target.__file,
      id: x.target.__id
    } as CachedAppConfig;
  }

  /**
   * Sort list of cached items
   * @param items
   */
  static async sortList(items: CachedAppConfig[]) {
    return items.sort((a, b) =>
      a.appRoot === b.appRoot ?
        a.name.localeCompare(b.name) :
        (a.appRoot === '.' ? -1 : 1));
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
        if (elStat && (!el.generatedTime || this.maxTime(elStat) > el.generatedTime)) {
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
   * Scan source code for apps
   */
  static async scanForApps() {

    // Load app files
    ScanApp.findAppSourceFiles()
      .filter(x => fs.readFileSync(x.file, 'utf-8').includes('@Application'))
      .forEach(x => require(x.file)); // Only load files that are candidates

    // Load all packaged applications
    for (const { file } of ScanApp.findFiles({ folder: 'support', filter: /application[.].*[.]ts/ })) {
      try {
        require(file);
      } catch { }
    }

    // Get applications
    const res = await ApplicationRegistry.getAll();

    // Convert each application into an `AppConfig`
    const items = Promise.all(res.map(x => AppListUtil.buildCacheAppConfig(x)));
    return AppListUtil.sortList(await items);
  }
}
