import { ExecutionResult, ExecutionOptions, ExecutionState, Env } from '@travetto/base';
import { CliModuleUtil } from '@travetto/cli';
import { IndexedModule } from '@travetto/manifest';
import { ColorUtil, IterableUtil, TermLinePosition, Terminal, TerminalOperation } from '@travetto/terminal';
import { WorkPool } from '@travetto/worker';

const COLORS = ([
  '#8787ff', '#87afff', '#87d7ff', '#87ff87', '#87ffaf', '#87ffd7', '#87ffff', '#af87ff', '#afafd7', '#afafff', '#afd7af', '#afd7d7', '#afd7ff', '#afff87', '#afffaf',
  '#afffd7', '#afffff', '#d787ff', '#d7afaf', '#d7afd7', '#d7afff', '#d7d7af', '#d7d7d7', '#d7d7ff', '#d7ff87', '#d7ffaf', '#d7ffd7', '#d7ffff', '#ff8787', '#ff87af',
  '#ff87d7', '#ff87ff', '#ffaf87', '#ffafaf', '#ffafd7', '#ffafff', '#ffd787', '#ffd7af', '#ffd7d7', '#ffd7ff', '#ffff87', '#ffffaf', '#ffffd7', '#ffffff', '#bcbcbc',
  '#c6c6c6', '#d0d0d0', '#dadada', '#e4e4e4', '#eeeeee'
] as const).map(x => ColorUtil.fromStyle(x));

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
      env: {
        ...Env.TRV_MANIFEST.export(''),
        ...Env.TRV_MODULE.export(mod.name)
      },
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

    config.showStdout = config.showStdout ?? (Env.DEBUG.isSet && !Env.DEBUG.isFalse);
    config.showStderr = config.showStderr ?? true;

    const workerCount = config.workerCount ?? WorkPool.DEFAULT_SIZE;

    const mods = await CliModuleUtil.findModules(mode);
    const results = new Map<IndexedModule, T>();
    const processes = new Map<IndexedModule, ExecutionState>();

    const prefixes = config.prefixOutput !== false ? this.#buildPrefixes(mods) : {};
    const stdoutTerm = new Terminal({ output: process.stdout });
    const stderrTerm = new Terminal({ output: process.stderr });

    const work = WorkPool.runStreamProgress(async (mod) => {
      try {
        if (!(await config.filter?.(mod) === false)) {
          const opts = RepoExecUtil.#buildExecutionOptions(mod, config, prefixes, stdoutTerm, stderrTerm);

          const result = await operation(mod, opts).result;

          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const output = (config.transformResult ? config.transformResult(mod, result) : result) as T;
          results.set(mod, output);
        }
        return config.progressMessage?.(mod) ?? mod.name;
      } finally {
        processes.get(mod!)?.process.kill('SIGKILL');
      }
    }, mods, mods.length, { max: workerCount, min: workerCount });

    if (config.progressMessage && stdoutTerm.interactive) {
      const cfg = { position: config.progressPosition ?? 'bottom' } as const;
      const theme = ColorUtil.fromStyle({ background: '#32cd32', text: '#ffffff' });
      await TerminalOperation.streamToPosition(stdoutTerm, IterableUtil.map(work, ev => {
        const text = ev.value ?? (ev.total ? '%idx/%total' : '%idx');
        const pct = ev.total === undefined ? 0 : (ev.idx / ev.total);
        const width = Math.trunc(Math.ceil(Math.log10(ev.total ?? 10000)));
        const state: Record<string, string> = { total: `${ev.total}`, idx: `${ev.idx}`.padStart(width), pct: `${Math.trunc(pct * 100)}` };
        const line = text.replace(/[%](idx|total|pct)/g, (_, k) => state[k]);
        const full = TerminalOperation.truncateIfNeeded(stdoutTerm, ` ${line}`.padEnd(stdoutTerm.width));
        const mid = Math.trunc(pct * stdoutTerm.width);
        const [l, r] = [full.substring(0, mid), full.substring(mid)];
        return `${theme(l)}${r}`;
      }), cfg);
    } else {
      for await (const _ of work) {
        // Ensure its all consumed
      }
    }

    return results;
  }
}