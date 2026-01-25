import type { ChildProcess } from 'node:child_process';

import { type ExecutionResult, Env, Util, ExecUtil, castTo, BinaryUtil } from '@travetto/runtime';
import { CliModuleUtil } from '@travetto/cli';
import type { IndexedModule } from '@travetto/manifest';
import { StyleUtil, Terminal, TerminalUtil } from '@travetto/terminal';
import { WorkPool } from '@travetto/worker';

const COLORS = ([...[
  '#8787ff', '#87afff', '#87d7ff', '#87ff87', '#87ffaf', '#87ffd7', '#87ffff', '#af87ff', '#afafd7', '#afafff', '#afd7af', '#afd7d7', '#afd7ff', '#afff87', '#afffaf',
  '#afffd7', '#afffff', '#d787ff', '#d7afaf', '#d7afd7', '#d7afff', '#d7d7af', '#d7d7d7', '#d7d7ff', '#d7ff87', '#d7ffaf', '#d7ffd7', '#d7ffff', '#ff8787', '#ff87af',
  '#ff87d7', '#ff87ff', '#ffaf87', '#ffafaf', '#ffafd7', '#ffafff', '#ffd787', '#ffd7af', '#ffd7d7', '#ffd7ff', '#ffff87', '#ffffaf', '#ffffd7', '#ffffff', '#bcbcbc',
  '#c6c6c6', '#d0d0d0', '#dadada', '#e4e4e4', '#eeeeee'
] as const]).toSorted(() => Math.random() < .5 ? -1 : 1).map(color => StyleUtil.getStyle(color));

type ModuleRunConfig<T = ExecutionResult<string>> = {
  progressMessage?: (module: IndexedModule | undefined) => string;
  filter?: (module: IndexedModule) => boolean | Promise<boolean>;
  transformResult?: (module: IndexedModule, result: ExecutionResult<string>) => T;
  workerCount?: number;
  prefixOutput?: boolean;
  showStdout?: boolean;
  showStderr?: boolean;
  stableOutput?: boolean;
};

const colorize = (value: string, idx: number): string => COLORS[idx % COLORS.length](value);

/**
 * Tools for running commands across all modules of the monorepo
 */
export class RepoExecUtil {

  /**
   * Build equal sized prefix labels for outputting
   * @param modules
   * @returns
   */
  static #buildPrefixes(modules: IndexedModule[]): Record<string, string> {
    const folders = modules.map(module => module.sourceFolder);
    const maxWidth = Math.max(...folders.map(folder => folder.length));
    return Object.fromEntries(folders.map((folder, i) => [folder, colorize(folder.padStart(maxWidth, ' ').padEnd(maxWidth + 1), i)]));
  }

  /**
   * Run on all modules
   */
  static async execOnModules<T = ExecutionResult>(
    mode: 'all' | 'workspace' | 'changed',
    operation: (module: IndexedModule) => ChildProcess,
    config: ModuleRunConfig<T> = {}
  ): Promise<Map<IndexedModule, T>> {

    config.showStdout = config.showStdout ?? (Env.DEBUG.isSet && !Env.DEBUG.isFalse);
    config.showStderr = config.showStderr ?? true;
    const transform = config.transformResult ?? ((module, result): T => castTo(result));

    const workerCount = config.workerCount ?? WorkPool.DEFAULT_SIZE;

    const modules = await CliModuleUtil.findModules(mode);
    const results = new Map<IndexedModule, T>();
    const processes = new Map<IndexedModule, ChildProcess>();

    const prefixes = config.prefixOutput !== false ? this.#buildPrefixes(modules) : {};
    const stdoutTerm = new Terminal(process.stdout);
    const stderrTerm = new Terminal(process.stderr);

    const work = WorkPool.runStreamProgress(async (module) => {
      try {
        if (!(await config.filter?.(module) === false)) {
          const prefix = prefixes[module.sourceFolder] ?? '';
          const subProcess = operation(module);
          processes.set(module, subProcess);

          if (config.showStdout && subProcess.stdout) {
            BinaryUtil.readLines(subProcess.stdout, line =>
              stdoutTerm.writer.writeLine(`${prefix}${line.trimEnd()}`).commit()
            );
          }
          if (config.showStderr && subProcess.stderr) {
            BinaryUtil.readLines(subProcess.stderr, line =>
              stderrTerm.writer.writeLine(`${prefix}${line.trimEnd()}`).commit()
            );
          }

          const result = await ExecUtil.getResult(subProcess, { catch: true });
          const output = transform(module, result);
          results.set(module, output);
        }
        return config.progressMessage?.(module) ?? module.name;
      } finally {
        processes.get(module!)?.kill();
      }
    }, modules, modules.length, { max: workerCount, min: workerCount });

    if (config.progressMessage && stdoutTerm.interactive) {
      await stdoutTerm.streamToBottom(Util.mapAsyncIterable(work, TerminalUtil.progressBarUpdater(stdoutTerm, { withWaiting: true })));
    } else {
      for await (const _ of work) {
        // Ensure its all consumed
      }
    }

    return results;
  }
}