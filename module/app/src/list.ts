import * as fs from 'fs';

import { ApplicationConfig } from './types';
import { ScanApp } from '@travetto/base';
import { ApplicationRegistry } from './registry';

/**
 * Utilities to fetch list of applications
 */
export class AppListUtil {

  /**
   * Sort list of cached items
   * @param items
   */
  static async sortList(items: ApplicationConfig[]) {
    return items.sort((a, b) =>
      a.root === b.root ?
        a.name.localeCompare(b.name) :
        (a.root === '.' ? -1 : 1));
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
    return AppListUtil.sortList(res);
  }
}
