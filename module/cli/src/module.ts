import tty from 'tty';
import rl from 'readline';

import { ColorDefineUtil, NAMED_COLORS, Terminal, GlobalTerminal, TermLinePosition } from '@travetto/terminal';
import { Env, ExecUtil, ExecutionOptions, ExecutionResult, ExecutionState, TypedObject } from '@travetto/base';
import { IndexedModule, PackageUtil, RootIndex } from '@travetto/manifest';
import { IterableWorkSet, WorkPool, type Worker } from '@travetto/worker';

import { CliScmUtil } from './scm';

type ModuleRunConfig<T> = {
  progressMessage?: (mod: IndexedModule | undefined) => string;
  filter?: (mod: IndexedModule) => boolean | Promise<boolean>;
  onComplete?: (mod: IndexedModule, res: T) => void;
  destroy?: (mod: IndexedModule) => void;
  progressStream?: tty.WriteStream | false;
  workerCount?: number;
  progressPosition?: TermLinePosition;
};

const COLORS = TypedObject.keys(NAMED_COLORS)
  .map(k => [k, ColorDefineUtil.defineColor(k).hsl] as const)
  .filter(([, [, s, l]]) => l > .5 && l < .8 && s > .8)
  .map(([k]) => GlobalTerminal.colorer(k));

const colorize = (val: string, idx: number): string => COLORS[idx % COLORS.length](val);

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
    operation: (mod: IndexedModule) => Promise<T>,
    config: ModuleRunConfig<T> = {}
  ): Promise<Map<IndexedModule, T>> {

    const workerCount = config.workerCount ?? WorkPool.DEFAULT_SIZE;

    const mods = await CliModuleUtil.findModules(mode);
    const results = new Map<IndexedModule, T>();

    let id = 1;
    const pool = new WorkPool(async () => {
      const worker: Worker<IndexedModule> = {
        id: id += 1,
        active: false,
        async destroy() {
          this.active = false;
        },
        async execute(mod: IndexedModule) {
          try {
            this.active = true;
            this.destroy = async (): Promise<void> => {
              this.active = false;
              config?.destroy?.(mod);
            };

            if (await config.filter?.(mod) === false) {
              this.active = false;
            } else {
              const output = await operation(mod);
              results.set(mod, output);
              await config.onComplete?.(mod, output);
            }
          } finally {
            this.active = false;
          }
        },
      };
      return worker;
    }, { max: workerCount, min: workerCount });

    const work = pool.iterateProcess(new IterableWorkSet(mods));

    if (config.progressMessage && config.progressStream !== false) {
      const cfg = { position: config.progressPosition ?? 'bottom' } as const;
      const stream = new Terminal({ output: config.progressStream ?? process.stderr });
      await stream.trackProgress(work, ev => ({ ...ev, text: config.progressMessage!(ev.value) }), cfg);
    } else {
      for await (const _ of work) {
        // Ensure its all consumed
      }
    }

    return results;
  }

  /**
   * Run on all modules
   */
  static async execOnModules<T>(
    mode: 'all' | 'changed',
    [cmd, ...args]: [string, ...string[]],
    config: ModuleRunConfig<ExecutionResult> & {
      prefixOutput?: boolean;
      showStdout?: boolean;
      showStderr?: boolean;
      onMessage?: (module: IndexedModule, msg: T) => void;
    } & Omit<ExecutionOptions, 'cwd'> = {}
  ): Promise<void> {

    const prefixOutput = config.prefixOutput ?? true;
    const showStdout = config.showStdout ?? (Env.isSet('DEBUG') && !Env.isFalse('DEBUG'));
    const showStderr = config.showStderr ?? true;
    const mods = await CliModuleUtil.findModules(mode);
    const folders = mods.map(x => x.workspaceRelative);
    const maxWidth = Math.max(...folders.map(x => x.length));
    const labels = Object.fromEntries(folders.map((x, i) => [x, colorize(x.padStart(maxWidth, ' '), i)]));

    const processes = new Map<IndexedModule, ExecutionState>();

    const stdoutTerm = new Terminal({ output: process.stdout });
    const stderrTerm = new Terminal({ output: process.stderr });

    await this.runOnModules(mode, mod => {
      const opts: ExecutionOptions = {
        stdio: [
          0,
          showStdout ? (prefixOutput ? 'pipe' : 'inherit') : 'ignore',
          showStderr ? (prefixOutput ? 'pipe' : 'inherit') : 'ignore',
          config.onMessage ? 'ipc' : 'ignore'
        ],
        ...config,
        cwd: mod.workspaceRelative,
        env: { ...config?.env, TRV_MANIFEST: '' }
      };

      const res = ExecUtil.spawn(cmd, args, opts);
      processes.set(mod, res);

      // Prefix output, if desired
      if (prefixOutput) {
        const folder = mod.workspaceRelative;
        if (showStderr) {
          const stderr = rl.createInterface(res.process.stderr!);
          stderr.on('line', line => stderrTerm.writeLines(`${labels[folder]}: ${line}`));
        }
        if (showStdout) {
          const stdout = rl.createInterface(res.process.stdout!);
          stdout.on('line', line => stdoutTerm.writeLines(`${labels[folder]}: ${line}`));
        }
      }

      if (config.onMessage) {
        res.process.on('message', config.onMessage.bind(config, mod));
      }
      return res.result.catchAsResult();
    }, {
      ...config,
      progressMessage: mod => `Running ${cmd} ${args.join(' ')} [%idx/%total] ${mod?.workspaceRelative ?? ''}`,
      destroy: mod => processes.get(mod)?.process.kill('SIGKILL')
    });
  }
}