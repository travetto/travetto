import { readFileSync } from 'fs';

import { SourceIndex } from '@travetto/boot/src/internal/source';
import { AppManifest } from '@travetto/base/src/manifest';
import { AppCache } from '@travetto/boot/src/cache';
import { SchemaRegistry } from '@travetto/schema';

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
  static sortList(items: ApplicationConfig[]): ApplicationConfig[] {
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Scan source code for apps
   */
  static async scanList(): Promise<ApplicationConfig[]> {

    await Promise.all(
      SourceIndex.findByFolders(AppManifest.source)
        .filter(x => readFileSync(AppCache.toEntryName(x.file), 'utf-8').includes('@Application'))
        .map(x => import(x.file)) // Only load files that are candidates
    );

    // Get applications
    const res = await ApplicationRegistry.getAll();
    await SchemaRegistry.init();
    const resolved = this.sortList(res);
    const config = resolved
      .map(({ target, ...app }) => ({
        ...app,
        params: SchemaRegistry.getMethodSchema(target!, 'run')
          .map(({ owner, type, match, ...x }) => ({
            ...x,
            ...(match ? { match: { re: match.re.source } } : {}),
            type: type.name,
          }))
      }));
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return config as ApplicationConfig[];
  }
}
