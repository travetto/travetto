import fs from 'fs';

import { Class } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';
import { SchemaRegistry } from '@travetto/schema';

import type { ApplicationParam, ApplicationConfig } from './types';
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
   * Get choice params for a given class
   */
  static getParams(target: Class<unknown>): ApplicationParam[] {
    const fields = SchemaRegistry.getMethodSchema(target!, 'run');
    return fields.map(({ owner, type, match, ...param }) => ({
      ...param,
      ...(match ? { match: { re: match.re.source } } : {}),
      type: type.name,
    }));
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
    return this.sortList(res).map(({ target, ...app }) => ({ ...app, params: this.getParams(target!) }));
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
      const mod = RootIndex.getModuleFromImport(item.import)!;
      for (const dep of RootIndex.getDependentModules(mod)) {
        if (!(dep?.local || dep?.main)) { continue; }
        final.push(({ ...item, module: dep.name, globalName: dep.name === RootIndex.mainModule.name ? item.name : `${dep.name}:${item.name}` }));
      }
    }
    return final;
  }
}
