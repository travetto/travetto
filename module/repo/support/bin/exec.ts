import { ChildProcess } from 'node:child_process';

import { ExecutionResult, Env, Util, ExecUtil, castTo } from '@travetto/runtime';
import { CliModuleUtil } from '@travetto/cli';
import type { IndexedModule } from '@travetto/manifest';
import { StyleUtil, Terminal, TerminalUtil } from '@travetto/terminal';
import { WorkPool } from '@travetto/worker';

const COLORS = ([...[
  '#8787ff', '#87afff', '#87d7ff', '#87ff87', '#87ffaf', '#87ffd7', '#87ffff', '#af87ff', '#afafd7', '#afafff', '#afd7af', '#afd7d7', '#afd7ff', '#afff87', '#afffaf',
  '#afffd7', '#afffff', '#d787ff', '#d7afaf', '#d7afd7', '#d7afff', '#d7d7af', '#d7d7d7', '#d7d7ff', '#d7ff87', '#d7ffaf', '#d7ffd7', '#d7ffff', '#ff8787', '#ff87af',
  '#ff87d7', '#ff87ff', '#ffaf87', '#ffafaf', '#ffafd7', '#ffafff', '#ffd787', '#ffd7af', '#ffd7d7', '#ffd7ff', '#ffff87', '#ffffaf', '#ffffd7', '#ffffff', '#bcbcbc',
  '#c6c6c6', '#d0d0d0', '#dadada', '#e4e4e4', '#eeeeee'
] as const]).sort((a, b) => Math.random() < .5 ? -1 : 1).map(x => StyleUtil.getStyle(x));

type ModuleRunConfig<T = ExecutionResult<string>> = {
  progressMessage?: (mod: IndexedModule | undefined) => string;
  filter?: (mod: IndexedModule) => boolean | Promise<boolean>;
  transformResult?: (mod: IndexedModule, result: ExecutionResult<string>) => T;
  workerCount?: number;
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
    operation: (mod: IndexedModule) => ChildProcess,
    config: ModuleRunConfig<T> = {}
  ): Promise<Map<IndexedModule, T>> {

    config.showStdout = config.showStdout ?? (Env.DEBUG.isSet && !Env.DEBUG.isFalse);
    config.showStderr = config.showStderr ?? true;
    const transform = config.transformResult ?? ((mod, result): T => castTo<T>(result));

    const workerCount = config.workerCount ?? WorkPool.DEFAULT_SIZE;

    const mods = await CliModuleUtil.findModules(mode);
    const results = new Map<IndexedModule, T>();
    const processes = new Map<IndexedModule, ChildProcess>();

    const prefixes = config.prefixOutput !== false ? this.#buildPrefixes(mods) : {};
    const stdoutTerm = new Terminal(process.stdout);
    const stderrTerm = new Terminal(process.stderr);

    const work = WorkPool.runStreamProgress(async (mod) => {
      try {
        if (!(await config.filter?.(mod) === false)) {
          const prefix = prefixes[mod.sourceFolder] ?? '';
          const proc = operation(mod);
          processes.set(mod, proc);

          if (config.showStdout && proc.stdout) {
            ExecUtil.readLines(proc.stdout, line =>
              stdoutTerm.writer.writeLine(`${prefix}${line.trimEnd()}`).commit()
            );
          }
          if (config.showStderr && proc.stderr) {
            ExecUtil.readLines(proc.stderr, line =>
              stderrTerm.writer.writeLine(`${prefix}${line.trimEnd()}`).commit()
            );
          }

          const result = await ExecUtil.getResult(proc, { catch: true });
          const output = transform(mod, result);
          results.set(mod, output);
        }
        return config.progressMessage?.(mod) ?? mod.name;
      } finally {
        processes.get(mod!)?.kill();
      }
    }, mods, mods.length, { max: workerCount, min: workerCount });

    if (config.progressMessage && stdoutTerm.interactive) {
      await stdoutTerm.streamToBottom(Util.mapAsyncItr(work, TerminalUtil.progressBarUpdater(stdoutTerm, { withWaiting: true })));
    } else {
      for await (const _ of work) {
        // Ensure its all consumed
      }
    }

    return results;
  }
}