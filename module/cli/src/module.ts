import rl from 'readline';

import { ColorDefineUtil, GlobalTerminal, NAMED_COLORS } from '@travetto/terminal';
import { Env, ExecUtil, ExecutionOptions, TypedObject } from '@travetto/base';
import { IndexedModule, PackageUtil, RootIndex } from '@travetto/manifest';
import { IterableWorkSet, WorkPool, type Worker } from '@travetto/worker';

import { CliScmUtil } from './scm';

const COLORS = TypedObject.keys(NAMED_COLORS)
  .map(k => [k, ColorDefineUtil.defineColor(k).hsl] as const)
  .filter(([, [, s, l]]) => l > .5 && l < .8 && s > .8)
  .map(([k]) => GlobalTerminal.colorer(k));

const colorize = (val: string, idx: number): string => COLORS[idx % COLORS.length](val);

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
   * Synchronize all workspace modules to have the correct versions from the current packages
   */
  static async synchronizeModuleVersions(): Promise<void> {
    await PackageUtil.syncVersions((await this.findModules('all')).map(x => x.source));
  }

  /**
   * Run on all modules
   */
  static async runOnModules<T>(
    mode: 'all' | 'changed',
    [cmd, ...args]: [string, ...string[]],
    config: {
      filter?: (folder: string) => boolean | Promise<boolean>;
      onMessage?: (folder: string, msg: T) => void;
      showProgress?: boolean;
      workerCount?: number;
      prefixOutput?: boolean;
      showStdout?: boolean;
    } & Omit<ExecutionOptions, 'cwd'> = {}
  ): Promise<void> {

    const workerCount = config.workerCount ?? WorkPool.DEFAULT_SIZE;
    const prefixOutput = config.prefixOutput ?? true;
    const showStdout = config.showStdout ?? (Env.isSet('DEBUG') && !Env.isFalse('DEBUG'));

    const folders = (await CliModuleUtil.findModules(mode)).map(x => x.workspaceRelative);
    const maxWidth = Math.max(...folders.map(x => x.length));
    const labels = Object.fromEntries(folders.map((x, i) => [x, colorize(x.padStart(maxWidth, ' '), i)]));

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

            if (await config.filter?.(folder) === false) {
              this.active = false;
              return;
            }

            const opts: ExecutionOptions = {
              stdio: [
                0,
                showStdout ? (prefixOutput ? 'pipe' : 'inherit') : 'ignore',
                prefixOutput ? 'pipe' : 'inherit',
                config.onMessage ? 'ipc' : 'ignore'
              ],
              ...config,
              cwd: folder,
              env: { ...config?.env, TRV_MANIFEST: '' }
            };

            const res = ExecUtil.spawn(cmd, args, opts);

            // Prefix output, if desired
            if (prefixOutput) {
              const stderr = rl.createInterface(res.process.stderr!);
              stderr.on('line', line => process.stderr.write(`${labels[folder]}: ${line}\n`));
              if (showStdout) {
                const stdout = rl.createInterface(res.process.stdout!);
                stdout.on('line', line => process.stdout.write(`${labels[folder]}: ${line}\n`));
              }
            }

            if (config.onMessage) {
              res.process.on('message', config.onMessage.bind(config, folder));
            }

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

    const work = pool.iterateProcess(new IterableWorkSet(folders));

    if (config.showProgress) {
      await GlobalTerminal.trackProgress(work, { message: ['Completed', cmd, ...args].join(' '), showBar: true });
    } else {
      for await (const _ of work) {
        // Ensure its all consumed
      }
    }
  }
}