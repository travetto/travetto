import * as fs from 'fs';
import * as util from 'util';
import { FsUtil } from '@travetto/boot/src/fs';

import { CachedAppConfig, ApplicationConfig } from './types';
import { ScanApp } from '@travetto/base';
import { ApplicationRegistry } from './registry';

/**
 * Utilities to fetch list of applications
 */
export class AppListUtil {

  private static fsLstat = util.promisify(fs.lstat);

  /**
   * Determine app root from filename
   */
  static determineRootFromFile(filename: string) {
    const [, root] = filename.split(`${FsUtil.cwd}/`);
    const [first] = root.split('/');
    // If root is in node_modules or is 'src', default to local
    // * This supports apps being run from modules vs locally
    return (first === 'node_modules' || first === 'src') ? '.' :
      root.split('/src')[0];
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
      generatedTime: FsUtil.maxTime(await this.fsLstat(x.target.__file)),
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
   * Scan source code for apps
   */
  static async buildList() {

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
