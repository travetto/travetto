import { Runtime, RuntimeIndex } from '@travetto/runtime';
import type { IndexedModule } from '@travetto/manifest';

import { CliScmUtil } from './scm.ts';

type ModuleGraphEntry = { children: Set<string>, name: string, active: Set<string>, parents?: string[] };

/**
 * Simple utilities for understanding modules for CLI use cases
 */
export class CliModuleUtil {

  /**
   * Find modules that changed, and the dependent modules
   * @param fromHash
   * @param toHash
   * @param transitive
   * @returns
   */
  static async findChangedModulesRecursive(fromHash?: string, toHash?: string, transitive = true): Promise<IndexedModule[]> {
    fromHash ??= await CliScmUtil.findLastRelease();

    if (!fromHash) {
      return RuntimeIndex.getWorkspaceModules();
    }

    const out = new Map<string, IndexedModule>();
    for (const mod of await CliScmUtil.findChangedModules(fromHash, toHash)) {
      out.set(mod.name, mod);
      if (transitive) {
        for (const sub of await RuntimeIndex.getDependentModules(mod, 'parents')) {
          out.set(sub.name, sub);
        }
      }
    }

    return [...out.values()]
      .toSorted((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Find modules that changed, and the dependent modules
   * @param hash
   * @param transitive
   * @returns
   */
  static async findModules(mode: 'all' | 'changed' | 'workspace', fromHash?: string, toHash?: string): Promise<IndexedModule[]> {
    return (mode === 'changed' ?
      await this.findChangedModulesRecursive(fromHash, toHash, true) :
      [...RuntimeIndex.getModuleList(mode)].map(x => RuntimeIndex.getModule(x)!)
    ).filter(x => x.sourcePath !== Runtime.workspace.path);
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
          for (const child of el.children) {
            par.children.add(child);
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

  /**
   * Find changed paths, either files between two git commits, or all folders for changed modules
   */
  static async findChangedPaths(config: { since?: string, changed?: boolean, logError?: boolean } = {}): Promise<string[]> {
    if (config.since) {
      try {
        const files = await CliScmUtil.findChangedFiles(config.since, 'HEAD');
        return files.filter(x => !x.endsWith('package.json') && !x.endsWith('package-lock.json'));
      } catch (error) {
        if (config.logError && error instanceof Error) {
          console.error(error.message);
        }
        return [];
      }
    } else {
      const mods = await this.findModules(config.changed ? 'changed' : 'workspace', undefined, 'HEAD');
      return mods.map(x => x.sourcePath);
    }
  }
}