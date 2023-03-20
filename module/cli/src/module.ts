import { ColorDefineUtil, NAMED_COLORS, Terminal, GlobalTerminal, TermLinePosition } from '@travetto/terminal';
import { Env, ExecutionOptions, ExecutionResult, ExecutionState, TypedObject } from '@travetto/base';
import { IndexedModule, PackageUtil, RootIndex } from '@travetto/manifest';
import { IterableWorkSet, WorkPool, type Worker } from '@travetto/worker';

import { CliScmUtil } from './scm';
import { CliValidationError } from './types';
import { CliUtil } from './util';

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

type ModuleGraphEntry = { children: Set<string>, name: string, active: Set<string>, parents?: string[] };

const COLORS = TypedObject.keys(NAMED_COLORS)
  .map(k => [k, ColorDefineUtil.defineColor(k).hsl] as const)
  .filter(([, [, s, l]]) => l > .5 && l < .8 && s > .8)
  .map(([k]) => GlobalTerminal.colorer(k));

const colorize = (val: string, idx: number): string => COLORS[idx % COLORS.length](val);

const modError = (message: string): CliValidationError => ({ source: 'flag', kind: 'required', path: 'module', message: `module: ${message}` });

/**
 * Simple utilities for understanding modules for CLI use cases
 */
export class CliModuleUtil {

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
   * Find modules that changed, and the dependent modules
   * @param hash
   * @param transitive
   * @returns
   */
  static async findChangedModulesRecursive(hash?: string, transitive = true): Promise<IndexedModule[]> {
    if (!hash) {
      hash = await CliScmUtil.findLastRelease();
    }

    if (!hash) {
      return RootIndex.getLocalModules();
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
    ).filter(x => x.sourcePath !== RootIndex.manifest.workspacePath);
  }

  /**
   * Synchronize all workspace modules to have the correct versions from the current packages
   */
  static async synchronizeModuleVersions(): Promise<Record<string, string>> {
    const versions = {};
    await PackageUtil.syncVersions((await this.findModules('all')).map(x => x.sourcePath), versions);
    return versions;
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
              const opts = CliModuleUtil.#buildExecutionOptions(mod, config, prefixes, stdoutTerm, stderrTerm);

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

  /**
   * Get module dependency graph, fully collapsed
   */
  static getDependencyGraph(mods: IndexedModule[]): Record<string, string[]> {
    const childMap: Map<string, ModuleGraphEntry> = new Map();
    const get = (name: string): ModuleGraphEntry =>
      childMap.has(name) ? childMap.get(name)! : childMap.set(name, { children: new Set(), name, active: new Set() }).get(name)!;

    for (const el of mods) {
      get(el.name).parents = el.parents;
      for (const dep of el.parents) {
        const par = get(dep);
        par.children.add(el.name); // Store child into parent
        par.active.add(el.name);
      }
    }

    const output: Record<string, string[]> = {};

    while (childMap.size > 0) {
      for (const el of [...childMap.values()].filter(x => x.active.size === 0)) {
        output[el.name] = [...el.children];
        for (const parent of el.parents ?? []) {
          const par = childMap.get(parent)!;
          // Extend children into parents
          for (const val of el.children) {
            par.children.add(val);
          }
          par.active.delete(el.name);
        }
        childMap.delete(el.name);
      }
    }
    return output;
  }

  /**
   * Validate the module status for a given cli command
   */
  static async validateCommandModule(selfMod: string, { module: mod }: { module?: string }): Promise<CliValidationError | undefined> {
    if (CliUtil.monoRoot && mod) {
      if (!RootIndex.getModule(mod)) {
        return modError(`${mod} is an unknown module`);
      } else {
        if (mod !== selfMod) {
          RootIndex.reinitForModule(mod);
        }

        const mods = await this.findModules('all');
        const graph = this.getDependencyGraph(mods);
        if (selfMod !== mod && !graph[mod].includes(selfMod)) {
          return modError(`${mod} does not have ${selfMod} as a dependency`);
        }
      }
    }
  }
}