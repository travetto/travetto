import { IndexedModule, RootIndex } from '@travetto/manifest';

import { CliScmUtil } from './scm';

type ModuleGraphEntry = { children: Set<string>, name: string, active: Set<string>, parents?: string[] };

/**
 * Simple utilities for understanding modules for CLI use cases
 */
export class CliModuleUtil {

  /**
   * Find modules that changed, and the dependent modules
   * @param hash
   * @param transitive
   * @returns
   */
  static async findChangedModulesRecursive(hash?: string, transitive = true): Promise<IndexedModule[]> {
    hash ??= await CliScmUtil.findLastRelease();

    if (!hash) {
      return RootIndex.getLocalModules();
    }

    const out = new Map<string, IndexedModule>();
    for (const mod of await CliScmUtil.findChangedModulesSince(hash)) {
      out.set(mod.name, mod);
      if (transitive) {
        for (const sub of await RootIndex.getDependentModules(mod)) {
          out.set(sub.name, sub);
        }
      }
    }

    return [...out.values()]
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Find modules that changed, and the dependent modules
   * @param hash
   * @param transitive
   * @returns
   */
  static async findModules(mode: 'all' | 'changed', sinceHash?: string): Promise<IndexedModule[]> {
    return (mode === 'changed' ?
      await this.findChangedModulesRecursive(sinceHash) :
      [...RootIndex.getModuleList('all')].map(x => RootIndex.getModule(x)!)
    ).filter(x => x.sourcePath !== RootIndex.manifest.workspacePath);
  }

  /**
   * Get module dependency graph, fully collapsed
   */
  static getDependencyGraph(mods: IndexedModule[]): Record<string, string[]> {
    const childMap: Map<string, ModuleGraphEntry> = new Map();
    const get = (name: string): ModuleGraphEntry =>
      childMap.has(name) ? childMap.get(name)! : childMap.set(name, { children: new Set(), name, active: new Set() }).get(name)!;

    for (const el of mods) {
      get(el.name).parents = el.parents;
      for (const dep of el.parents) {
        const par = get(dep);
        par.children.add(el.name); // Store child into parent
        par.active.add(el.name);
      }
    }

    const output: Record<string, string[]> = {};

    while (childMap.size > 0) {
      for (const el of [...childMap.values()].filter(x => x.active.size === 0)) {
        output[el.name] = [...el.children];
        for (const parent of el.parents ?? []) {
          const par = childMap.get(parent)!;
          // Extend children into parents
          for (const val of el.children) {
            par.children.add(val);
          }
          par.active.delete(el.name);
        }
        childMap.delete(el.name);
      }
    }
    return output;
  }

  /**
   * Determine if module has a given dependency
   */
  static async moduleHasDependency(modName: string, depModName: string): Promise<boolean> {
    if (modName === depModName) {
      return true;
    }
    const mods = await this.findModules('all');
    const graph = this.getDependencyGraph(mods);
    return graph[modName].includes(depModName);
  }
}