import * as fs from 'fs';

import { SourceCodeIndex } from '@travetto/boot/src/internal/code';
import { AppManifest } from '@travetto/base/src/manifest';

import { ApplicationConfig } from './types';
import { ApplicationRegistry } from './registry';

/**
 * Utilities to fetch list of applications
 */
export class AppScanUtil {

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
  static async scanList() {

    await Promise.all(
      SourceCodeIndex.findByFolders(AppManifest.source)
        .filter(x => fs.readFileSync(x.file, 'utf-8').includes('@Application'))
        .map(x => import(x.file)) // Only load files that are candidates
    );

    // Get applications
    const res = await ApplicationRegistry.getAll();
    return this.sortList(res);
  }
}
