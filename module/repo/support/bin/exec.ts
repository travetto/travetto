import type { ChildProcess } from 'node:child_process';

import { type ExecutionResult, Env, Util, ExecUtil, castTo, CodecUtil, Runtime, RuntimeIndex, AsyncQueue } from '@travetto/runtime';
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
  progressListKey?: (module: IndexedModule) => string;
  showProgressList?: boolean;
  workerCount?: number;
  prefixOutput?: boolean;
  showStdout?: boolean;
  showStderr?: boolean;
  stableOutput?: boolean;
  includeMonorepoRoot?: boolean;
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

    if (Runtime.workspace.mono && config.includeMonorepoRoot && !modules.some(module => module.name === Runtime.workspace.name)) {
      modules.push(RuntimeIndex.getModule(Runtime.workspace.name)!);
    }

    const active = new Set<string>();
    const activeItems = new AsyncQueue<{ idx: number, text: string }>();
    const listHeader = ['', 'Modules in progress', '-------------------'];

    if (stdoutTerm.interactive && config.showProgressList) {
      stdoutTerm.writer.writeLines(listHeader).commit();
    }

    const modulesToRun = (config.filter ? await Promise.all(
      modules.map(async module => (await config.filter!(module)) ? module : undefined)
    ) : modules)
      .filter((module): module is IndexedModule => !!module);

    const work = WorkPool.runStreamProgress(async (module) => {
      try {
        const prefix = prefixes[module.sourceFolder] ?? '';
        const listKey = config.progressListKey?.(module) ?? ` * ${module.name}`;
        active.add(listKey);
        [...active].sort().forEach((text, idx) => activeItems.add({ idx, text }));

        const subProcess = operation(module);
        processes.set(module, subProcess);

        if (config.showStdout && subProcess.stdout) {
          CodecUtil.readLines(subProcess.stdout, line =>
            stdoutTerm.writer.writeLine(`${prefix}${line.trimEnd()}`).commit()
          );
        }
        if (config.showStderr && subProcess.stderr) {
          CodecUtil.readLines(subProcess.stderr, line =>
            stderrTerm.writer.writeLine(`${prefix}${line.trimEnd()}`).commit()
          );
        }

        const result = await ExecUtil.getResult(subProcess, { catch: true });
        const output = transform(module, result);

        active.delete(listKey);
        [...active].sort().forEach((text, idx) => activeItems.add({ idx, text }));
        for (let j = active.size; j < workerCount; j++) {
          activeItems.add({ idx: j, text: '' }); // Force update to remove item if needed
        }

        results.set(module, output);
        return config.progressMessage?.(module) ?? module.name;
      } finally {
        processes.get(module!)?.kill();
      }
    }, modulesToRun, modules.length, { max: workerCount, min: workerCount });

    if (config.progressMessage && stdoutTerm.interactive) {
      if (config.showProgressList) {
        stdoutTerm.streamList(activeItems);
      }
      await stdoutTerm.streamToBottom(Util.mapAsyncIterable(work, TerminalUtil.progressBarUpdater(stdoutTerm, { withWaiting: true })));

      if (stdoutTerm.interactive && config.showProgressList) {
        stdoutTerm.writer.changePosition({ y: -listHeader.length, x: 0 }).storePosition().writeLines(Array(listHeader.length).fill('')).restoreOnCommit().commit();
      }
    } else {
      for await (const _ of work) {
        // Ensure its all consumed
      }
    }

    return results;
  }
}