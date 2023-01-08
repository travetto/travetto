import fs from 'fs';

import { RootIndex } from '@travetto/manifest';
import { SchemaRegistry } from '@travetto/schema';

import type { ApplicationConfig } from './types';
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
      RootIndex.findSrc()
        .filter(x => fs.readFileSync(x.output, 'utf8').includes('@Application'))
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

  /**
   * Expand application configurations by dependent modules
   * @param items
   * @returns
   */
  static expandByDependents(items: ApplicationConfig[]): ApplicationConfig[] {
    if (!RootIndex.isMonoRepoRoot()) {
      return items;
    }
    const final: ApplicationConfig[] = [];
    for (const item of items) {
      const mod = RootIndex.getModuleFromSource(item.filename);
      if (!(mod?.local || mod?.main)) { continue; }
      for (const dep of RootIndex.getDependentModules(mod)) {
        final.push(({ ...item, module: dep.name, moduleName: `${dep.name}:${item.name}` }));
      }
    }
    return final;
  }
}
