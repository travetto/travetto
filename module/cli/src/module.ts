import os from 'os';

import { ExecUtil, ExecutionOptions } from '@travetto/base';
import { IndexedModule, ModuleIndex } from '@travetto/boot';
import { path } from '@travetto/manifest';
import { IterableWorkSet, WorkPool, type Worker } from '@travetto/worker';

/**
 * Simple utilities for understanding modules for CLI use cases
 */
export class CliModuleUtil {

  static isMonoRepoRoot(): boolean {
    return !!ModuleIndex.manifest.monoRepo &&
      ModuleIndex.manifest.workspacePath === ModuleIndex.manifest.mainPath;
  }

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
    return (mode === 'changed' ?
      await this.findChangedModulesRecursive() :
      [...ModuleIndex.getModuleList('all')].map(x => ModuleIndex.getModule(x)!)
    ).filter(x => x.source !== ModuleIndex.manifest.workspacePath);
  }

  /**
   * Run on all modules
   */
  static async runOnModules<T>(
    mode: 'all' | 'changed',
    [cmd, ...args]: [string, ...string[]],
    onMessage: (folder: string, msg: T) => void,
    workerCount = os.cpus.length - 1
  ): Promise<void> {
    // Run test
    const folders = (await CliModuleUtil.findModules(mode)).map(x => x.workspaceRelative);
    let id = 1;
    const pool = new WorkPool(async () => {
      const worker: Worker<string> = {
        id: id += 1,
        active: false,
        async destroy() {
          this.active = false;
        },
        async execute(folder: string) {
          try {
            this.active = true;

            const opts: ExecutionOptions = {
              cwd: folder,
              stdio: [0, process.env.DEBUG ? 'inherit' : 'pipe', 2, 'ipc'],
              env: {
                TRV_MANIFEST: '',
                TRV_OUTPUT: process.env.TRV_OUTPUT
              }
            };

            await ExecUtil.spawn('trv', ['manifest'], { ...opts, stdio: 'ignore' }).result;

            const res = ExecUtil.spawn(cmd, args, opts);
            res.process.on('message', (msg: T) => onMessage(folder, msg));
            this.destroy = async (): Promise<void> => {
              this.active = false;
              res.process.kill('SIGTERM');
            };
            await res.result;
          } catch {
            // Ignore
          } finally {
            this.active = false;
          }
        },
      };
      return worker;
    }, { max: workerCount, min: workerCount });

    const work = new IterableWorkSet(folders);
    await pool.process(work);
  }
}