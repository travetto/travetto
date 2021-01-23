import * as fs from 'fs';

import { SourceIndex } from '@travetto/boot';
import { AppManifest } from '@travetto/base/src/manifest';

import { ApplicationConfig } from './types';
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
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Scan source code for apps
   */
  static async buildList() {

    SourceIndex.findByFolders(AppManifest.source)
      .filter(x => fs.readFileSync(x.file, 'utf-8').includes('@Application'))
      .forEach(x => require(x.file)); // Only load files that are candidates

    // Get applications
    const res = await ApplicationRegistry.getAll();
    return this.sortList(res);
  }
}
