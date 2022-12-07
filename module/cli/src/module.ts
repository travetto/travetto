import { ExecUtil, ExecutionOptions } from '@travetto/base';
import { IndexedModule, ModuleIndex } from '@travetto/boot';
import { IterableWorkSet, WorkPool, type Worker } from '@travetto/worker';

import { CliScmUtil } from './scm';

/**
 * Simple utilities for understanding modules for CLI use cases
 */
export class CliModuleUtil {

  static isMonoRepoRoot(): boolean {
    return !!ModuleIndex.manifest.monoRepo &&
      ModuleIndex.manifest.workspacePath === ModuleIndex.manifest.mainPath;
  }

  /**
   * Find modules that changed, and the dependent modules
   * @param hash
   * @param transitive
   * @returns
   */
  static async findChangedModulesRecursive(hash?: string, transitive = true): Promise<IndexedModule[]> {
    if (!hash) {
      hash = await CliScmUtil.findLastRelease();
    }

    const out = new Map<string, IndexedModule>();
    for (const mod of await CliScmUtil.findChangedModulesSince(hash)) {
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
    config: {
      onMessage?: (folder: string, msg: T) => void;
      workerCount?: number;
      stdio?: ExecutionOptions['stdio'];
    } = {}
  ): Promise<void> {

    const workerCount = config.workerCount ?? WorkPool.DEFAULT_SIZE;

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
              stdio: config.stdio ?? [0, process.env.DEBUG ? 'inherit' : 'pipe', 2, 'ipc'],
              env: {
                TRV_MANIFEST: ''
              }
            };

            const res = ExecUtil.spawn(cmd, args, opts);
            res.process.on('message', (msg: T) => config.onMessage?.(folder, msg));
            this.destroy = async (): Promise<void> => {
              this.active = false;
              res.process.kill('SIGTERM');
            };
            await res.result.catchAsResult();
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