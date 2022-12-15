import rl from 'readline';

import { ExecUtil, ExecutionOptions } from '@travetto/base';
import { IndexedModule, RootIndex } from '@travetto/manifest';
import { IterableWorkSet, WorkPool, type Worker } from '@travetto/worker';

import { CliScmUtil } from './scm';

/**
 * Simple utilities for understanding modules for CLI use cases
 */
export class CliModuleUtil {

  static isMonoRepoRoot(): boolean {
    return !!RootIndex.manifest.monoRepo &&
      RootIndex.manifest.workspacePath === RootIndex.manifest.mainPath;
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
  static async findModules(mode: 'all' | 'changed'): Promise<IndexedModule[]> {
    return (mode === 'changed' ?
      await this.findChangedModulesRecursive() :
      [...RootIndex.getModuleList('all')].map(x => RootIndex.getModule(x)!)
    ).filter(x => x.source !== RootIndex.manifest.workspacePath);
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
    } & Omit<ExecutionOptions, 'cwd'> = {}
  ): Promise<void> {

    const workerCount = config.workerCount ?? WorkPool.DEFAULT_SIZE;

    // Run test
    const folders = (await CliModuleUtil.findModules(mode)).map(x => x.workspaceRelative);
    const maxWidth = Math.max(...folders.map(x => x.length));
    const labels = Object.fromEntries(folders.map(x => [x, x.padStart(maxWidth, ' ')]));

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
              stdio: [0, process.env.DEBUG ? 'inherit' : 'pipe', 'pipe', 'ipc'],
              ...config,
              cwd: folder,
              env: { ...config?.env, TRV_MANIFEST: '' }
            };

            const res = ExecUtil.spawn(cmd, args, opts);
            const stderr = rl.createInterface(res.process.stderr!);
            stderr.on('line', line => process.stderr.write(`${labels[folder]}: ${line}\n`));

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