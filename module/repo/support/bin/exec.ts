import { ExecutionResult, ExecutionOptions, ExecutionState, Env, TypedObject } from '@travetto/base';
import { CliModuleUtil } from '@travetto/cli';
import { IndexedModule } from '@travetto/manifest';
import { ColorDefineUtil, GlobalTerminal, NAMED_COLORS, TermLinePosition, Terminal } from '@travetto/terminal';
import { WorkPool, Worker, IterableWorkSet } from '@travetto/worker';

type ModuleRunConfig<T = ExecutionResult> = {
  progressMessage?: (mod: IndexedModule | undefined) => string;
  filter?: (mod: IndexedModule) => boolean | Promise<boolean>;
  transformResult?: (mod: IndexedModule, result: ExecutionResult) => T;
  workerCount?: number;
  progressPosition?: TermLinePosition;
  prefixOutput?: boolean;
  showStdout?: boolean;
  showStderr?: boolean;
};

const COLORS = TypedObject.keys(NAMED_COLORS)
  .map(k => [k, ColorDefineUtil.defineColor(k).hsl] as const)
  .filter(([, [, s, l]]) => l > .5 && l < .8 && s > .8)
  .map(([k]) => GlobalTerminal.colorer(k));

const colorize = (val: string, idx: number): string => COLORS[idx % COLORS.length](val);

/**
 * Tools for running commands across all modules of the monorepo
 */
export class RepoExecUtil {
  /**
   * Generate execution options for running on modules
   */
  static #buildExecutionOptions<T = ExecutionState>(
    mod: IndexedModule,
    config: ModuleRunConfig<T>,
    prefixes: Record<string, string>,
    stdoutTerm: Terminal,
    stderrTerm: Terminal
  ): ExecutionOptions {
    const folder = mod.sourceFolder;
    const opts: ExecutionOptions = {
      stdio: ['ignore', 'pipe', 'pipe', 'ignore'],
      outputMode: 'text',
      catchAsResult: true,
      cwd: folder,
      env: { TRV_MANIFEST: '', TRV_MODULE: mod.name },
    };

    if (config.showStdout) {
      opts.onStdOutLine = (line: string): unknown => stdoutTerm.writeLines(`${prefixes[folder] ?? ''}${line}`);
    }
    if (config.showStderr) {
      opts.onStdErrorLine = (line: string): unknown => stderrTerm.writeLines(`${prefixes[folder] ?? ''}${line}`);
    }
    return opts;
  }

  /**
   * Build equal sized prefix labels for outputting
   * @param mods
   * @returns
   */
  static #buildPrefixes(mods: IndexedModule[]): Record<string, string> {
    const folders = mods.map(x => x.sourceFolder);
    const maxWidth = Math.max(...folders.map(x => x.length));
    return Object.fromEntries(folders.map((x, i) => [x, colorize(x.padStart(maxWidth, ' ').padEnd(maxWidth + 1), i)]));
  }

  /**
   * Run on all modules
   */
  static async execOnModules<T = ExecutionResult>(
    mode: 'all' | 'changed',
    operation: (mod: IndexedModule, options: ExecutionOptions) => ExecutionState,
    config: ModuleRunConfig<T> = {}
  ): Promise<Map<IndexedModule, T>> {

    config.showStdout = config.showStdout ?? (Env.isSet('DEBUG') && !Env.isFalse('DEBUG'));
    config.showStderr = config.showStderr ?? true;

    const workerCount = config.workerCount ?? WorkPool.DEFAULT_SIZE;

    const mods = await CliModuleUtil.findModules(mode);
    const results = new Map<IndexedModule, T>();
    const processes = new Map<IndexedModule, ExecutionState>();

    const prefixes = config.prefixOutput !== false ? this.#buildPrefixes(mods) : {};
    const stdoutTerm = await Terminal.for({ output: process.stdout });
    const stderrTerm = await Terminal.for({ output: process.stderr });

    let id = 1;
    const pool = new WorkPool(async () => {
      const worker: Worker<IndexedModule> & { mod?: IndexedModule } = {
        id: id += 1,
        mod: undefined,
        active: false,
        async destroy() {
          this.active = false;
          processes.get(this.mod!)?.process.kill('SIGKILL');
        },
        async execute(mod: IndexedModule) {
          try {
            this.mod = mod;
            this.active = true;

            if (await config.filter?.(mod) === false) {
              this.active = false;
            } else {
              const opts = RepoExecUtil.#buildExecutionOptions(mod, config, prefixes, stdoutTerm, stderrTerm);

              const result = await operation(mod, opts).result;

              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              const output = (config.transformResult ? config.transformResult(mod, result) : result) as T;
              results.set(mod, output);
            }
          } finally {
            this.active = false;
            delete this.mod;
          }
        },
      };
      return worker;
    }, { max: workerCount, min: workerCount });

    const work = pool.iterateProcess(new IterableWorkSet(mods));

    if (config.progressMessage) {
      const cfg = { position: config.progressPosition ?? 'bottom' } as const;
      await stdoutTerm.trackProgress(work, ev => ({ ...ev, text: config.progressMessage!(ev.value) }), cfg);
    } else {
      for await (const _ of work) {
        // Ensure its all consumed
      }
    }

    return results;
  }
}