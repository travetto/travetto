import { appendFile, mkdir } from 'fs/promises';
import type commander from 'commander';

import { path } from '@travetto/manifest';
import { ConsoleManager, DataUtil, defineGlobalEnv, GlobalEnvConfig, ShutdownManager } from '@travetto/base';

import { HelpUtil } from './help';

type OptionPrimitive = string | number | boolean;

type CoreOptionConfig<K> = {
  type?: Function;
  key?: string;
  short?: string | false;
  name?: string;
  desc: string;
  completion?: boolean;
  def?: K;
  combine?: (v: string, curr: K) => K;
};

export type OptionConfig<K extends OptionPrimitive = OptionPrimitive> = CoreOptionConfig<K> & {
  choices?: K[] | readonly K[];
};

export type ListOptionConfig<K extends OptionPrimitive = OptionPrimitive> = CoreOptionConfig<K[]>;

type AllOptionConfig<K extends OptionPrimitive = OptionPrimitive> = OptionConfig<K> | ListOptionConfig<K>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OptionMap<T = any> = { [key in keyof T]: T[key] extends OptionPrimitive ? AllOptionConfig<T[key]> : never };

type Shape<M extends OptionMap> = { [k in keyof M]: Exclude<M[k]['def'], undefined> };

function clamp(v: number, l?: number, u?: number): number | undefined {
  if (l !== undefined && v < l) { return; }
  if (u !== undefined && v > u) { return; }
  return v;
}

/**
 * Base command
 */
export abstract class CliCommand<V extends OptionMap = OptionMap> {
  /**
   * Command object
   */
  #cmd: commander.Command;

  /**
   * Allow unknown options
   */
  allowUnknownOptions = false;

  /**
   * CLI command name
   */
  abstract get name(): string;

  /**
   * Action target of the command
   * @param args Cli args
   */
  abstract action(...args: unknown[]): void | Promise<void>;

  /**
   * Setup environment before command runs
   */
  envInit?(): Promise<GlobalEnvConfig> | GlobalEnvConfig;
  /**
   * Get Options for commander
   */
  getOptions?(): V;
  /**
    * Get args
    */
  getArgs?(): string | undefined;
  /**
   * Initialization code for adding options
   */
  init?(cmd: commander.Command): commander.Command | Promise<commander.Command>;
  /**
   * Extra help
   */
  help?(): Promise<string> | string;
  /**
   * Supports JSON IPC?
   */
  jsonIpc?(...args: unknown[]): Promise<unknown>;
  /**
   * Is the command active/eligible for usage
   */
  isActive?(): boolean;
  /**
   * Define option
   */
  option<K extends OptionPrimitive, T extends OptionConfig<K>>(cfg: T): T {
    if ('combine' in cfg && cfg.combine && cfg.def !== undefined && !Array.isArray(cfg.def)) {
      cfg.def = cfg.combine(`${cfg.def}`, cfg.def);
    }
    return { type: String, ...cfg };
  }

  /**
   * Define option
   */
  choiceOption<K extends string, T extends (OptionConfig<K> & { choices: K[] | readonly K[] })>({ choices, ...cfg }: T): T {
    // @ts-expect-error
    const config: T = {
      type: String,
      combine: (v: K, acc) => {
        if (v && !choices.includes(v)) {
          this.showHelp(`Invalid choice: ${v}.  Supported values are: ${choices.join(', ')}`);
          return this.exit(1);
        }
        return v ?? acc;
      },
      choices,
      completion: true,
      ...cfg
    };
    return config;
  }

  /**
   * Define list option
   */
  listOption<T extends ListOptionConfig<string>>(cfg: T): T {
    return {
      type: String,
      def: [],
      combine: (v: string, acc: string[]) => acc.concat(v),
      completion: true,
      ...cfg
    };
  }

  /**
   * Define bool option
   */
  boolOption(cfg: OptionConfig<boolean>): OptionConfig<boolean> {
    return {
      type: Boolean,
      combine: (val, curr): boolean =>
        (val !== undefined ? DataUtil.coerceType(val, Boolean, false) : undefined) ?? curr,
      completion: true,
      ...cfg
    };
  }

  /**
   * Define int option
   */
  intOption({ lower, upper, ...cfg }: OptionConfig<number> & { lower?: number, upper?: number }): OptionConfig<number> {
    return {
      type: Number,
      combine: (val, curr): number => clamp(DataUtil.coerceType(val, Number, false), lower, upper) ?? curr,
      ...cfg
    };
  }

  /**
   * Expose configuration as constrained typed object
   */
  get cmd(): Shape<V> {
    return this.#cmd.opts();
  }

  /**
   * Expose command line arguments
   */
  get args(): string[] {
    return this.#cmd.args;
  }

  exit(code = 0): Promise<void> {
    return ShutdownManager.exit(code);
  }

  /**
   * Render help with additional message or extra text
   */
  async showHelp(err?: string | Error, extra?: string, exitOnError = true): Promise<void> {
    if (err && typeof err !== 'string') {
      err = err.message;
    }
    HelpUtil.showHelp(this.#cmd, err, extra || (await this.help?.()) || '');
    if (exitOnError) {
      return this.exit(err ? 1 : 0);
    }
  }

  /**
   * Process all options into final set before registering with commander
   * @returns
   */
  async finalizeOptions(): Promise<AllOptionConfig[]> {
    const opts = this.getOptions?.();
    const used = new Set();

    return (opts ? Object.entries<AllOptionConfig>(opts) : []).map(([k, cfg]) => {
      cfg.key = k;
      cfg.name ??= k.replace(/([a-z])([A-Z])/g, (_, l, r: string) => `${l}-${r.toLowerCase()}`);
      if (cfg.short === undefined) {
        cfg.short = cfg.name.charAt(0);
        if (used.has(cfg.short)) {
          delete cfg.short;
        }
      }
      used.add(cfg.short);
      return cfg;
    });
  }

  /**
   * Receive the commander object, and process
   */
  async setup(cmd: commander.Command): Promise<commander.Command> {
    cmd = cmd.command(this.name);
    if (this.allowUnknownOptions) {
      cmd = cmd.allowUnknownOption(true);
    }
    if (this.init) {
      cmd = await this.init?.(cmd);
    }
    const args = this.getArgs?.();
    if (args) {
      cmd = cmd.arguments(args);
    }

    for (const cfg of await this.finalizeOptions()) {
      const pre = cfg.short ? `-${cfg.short}, ` : '';
      if (cfg.type === Boolean) {
        if (cfg.def) {
          cmd = cmd.option(`${pre}--no-${cfg.name}`, `Disables: ${cfg.desc}`);
        } else {
          cmd = cmd.option(`${pre}--${cfg.name}`, cfg.desc);
        }
      } else {
        const key = `${pre}--${cfg.name} <${cfg.name}>`;
        // @ts-expect-error
        cmd = cmd.option(key, cfg.desc, cfg.combine ?? ((cur, acc): unknown => cur), cfg.def);
      }
    }

    cmd = cmd.action(this.runAction.bind(this));

    // @ts-expect-error, Do nothing
    cmd.missingArgument = (): void => { };

    return this.#cmd = cmd;
  }

  /**
   * Runs the action at execution time
   */
  async runAction(...args: unknown[]): Promise<void> {
    if (this.envInit) {
      defineGlobalEnv(await this.envInit());
      ConsoleManager.setDebugFromEnv();
    }

    if (process.env.TRV_CLI_IPC && this.jsonIpc) {
      const data = await this.jsonIpc(...args);
      if (data !== undefined) {
        const payload = JSON.stringify({ type: this.name, data });
        await mkdir(path.dirname(process.env.TRV_CLI_IPC), { recursive: true });
        await appendFile(process.env.TRV_CLI_IPC, `${payload}\n`);
        return;
      }
    }
    return await this.action(...args);
  }
}