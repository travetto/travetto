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
    for (const module of await CliScmUtil.findChangedModules(fromHash, toHash)) {
      out.set(module.name, module);
      if (transitive) {
        for (const sub of RuntimeIndex.getDependentModules(module, 'parents')) {
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
      [...RuntimeIndex.getModuleList(mode)].map(name => RuntimeIndex.getModule(name)!)
    ).filter(module => module.sourcePath !== Runtime.workspace.path);
  }

  /**
   * Get module dependency graph, fully collapsed
   */
  static getDependencyGraph(modules: IndexedModule[]): Record<string, string[]> {
    const childMap: Map<string, ModuleGraphEntry> = new Map();
    const get = (name: string): ModuleGraphEntry =>
      childMap.has(name) ? childMap.get(name)! : childMap.set(name, { children: new Set(), name, active: new Set() }).get(name)!;

    for (const module of modules) {
      get(module.name).parents = [...module.parents];
      get(module.name).children = new Set(module.children);
      for (const parentModule of module.parents) {
        const parent = get(parentModule);
        parent.children.add(module.name); // Store child into parent
        parent.active.add(module.name);
      }
    }

    const output: Record<string, string[]> = {};

    while (childMap.size > 0) {
      for (const item of [...childMap.values()].filter(entry => entry.active.size === 0)) {
        output[item.name] = [...item.children];
        for (const parent of item.parents ?? []) {
          const par = childMap.get(parent)!;
          // Extend children into parents
          for (const child of item.children) {
            par.children.add(child);
          }
          par.active.delete(item.name);
        }
        childMap.delete(item.name);
      }
    }
    return output;
  }

  /**
   * Determine if module has a given dependency
   */
  static async moduleHasDependency(moduleName: string, dependencyModuleName: string): Promise<boolean> {
    if (moduleName === dependencyModuleName) {
      return true;
    }
    const modules = await this.findModules('all');
    const graph = this.getDependencyGraph(modules);
    return graph[moduleName].includes(dependencyModuleName);
  }

  /**
   * Find changed paths, either files between two git commits, or all folders for changed modules
   */
  static async findChangedPaths(config: { since?: string, changed?: boolean, logError?: boolean } = {}): Promise<string[]> {
    if (config.since) {
      try {
        const files = await CliScmUtil.findChangedFiles(config.since, 'HEAD');
        return files.filter(file => !file.endsWith('package.json') && !file.endsWith('package-lock.json'));
      } catch (error) {
        if (config.logError && error instanceof Error) {
          console.error(error.message);
        }
        return [];
      }
    } else {
      const modules = await this.findModules(config.changed ? 'changed' : 'workspace', undefined, 'HEAD');
      return modules.map(module => module.sourcePath);
    }
  }
}