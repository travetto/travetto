import { ExecUtil } from '@travetto/base';
import { IndexedModule, ModuleIndex } from '@travetto/boot';
import { path } from '@travetto/manifest';

/**
 * Simple utilities for understanding modules for CLI use cases
 */
export class CliModuleUtil {

  /**
   * Find the last code release
   * @returns 
   */
  static async findLastRelease(): Promise<string> {
    const root = await ModuleIndex.manifest;
    const { result } = ExecUtil.spawn('git', ['log', '--pretty=oneline'], { cwd: root.workspacePath });
    return (await result)
      .stdout.split(/\n/)
      .find(x => /Publish /.test(x))!
      .split(/\s+/)[0]!;
  }

  /**
   * Find all modules that changed since hash
   * @param hash 
   * @returns 
   */
  static async findChangedModulesSince(hash: string): Promise<IndexedModule[]> {
    const root = await ModuleIndex.manifest;

    const result = await ExecUtil.spawn('git', ['diff', '--name-only', `HEAD..${hash}`], { cwd: root.workspacePath }).result;
    const out = new Set<IndexedModule>();
    for (const line of result.stdout.split(/\n/g)) {
      const mod = ModuleIndex.getFromSource(path.resolve(root.workspacePath, line));
      if (mod) {
        out.add(ModuleIndex.getModule(mod.module)!);
      }
    }
    return [...out].sort((a, b) => a.name.localeCompare(b.name));
  }


  /**
   * Find modules that changed, and the dependent modules 
   * @param hash 
   * @param transitive 
   * @returns 
   */
  static async findChangedModulesRecursive(hash?: string, transitive = true): Promise<IndexedModule[]> {
    if (!hash) {
      hash = await this.findLastRelease();
    }

    const out = new Map<string, IndexedModule>();
    for (const mod of await this.findChangedModulesSince(hash)) {
      out.set(mod.name, mod);
      if (transitive) {
        for (const sub of await ModuleIndex.getDependentModules(mod)) {
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
  static async findModules(mode: 'all' | 'changed'): Promise<IndexedModule[]> {
    return mode === 'changed' ?
      await this.findChangedModulesRecursive() :
      [...ModuleIndex.getModuleList('all')].map(x => ModuleIndex.getModule(x)!)
  }
}