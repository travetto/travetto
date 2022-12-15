import fs from 'fs';

import { ModuleIndex } from '@travetto/boot';
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
      ModuleIndex.find({ folder: 'src' })
        .filter(x => fs.readFileSync(x.output).includes('@Application'))
        .map(x => import(x.output)) // Only load files that are candidates
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
