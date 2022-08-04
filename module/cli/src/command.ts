import * as commander from 'commander';

import { CompletionConfig } from './types';
import { HelpUtil } from './help';
import { CliUtil } from './util';

type Completion = Record<string, string[]>;

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
type OptionMap<T = any> = { [key in keyof T]: T[key] extends OptionPrimitive ? AllOptionConfig<T[key]> : never };

type Shape<M extends OptionMap> = { [k in keyof M]: Exclude<M[k]['def'], undefined> };

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
  envInit?(): Promise<void> | void;
  /**
   * Get Options for commander
   */
  getOptions?(): V;
  /**
    * Get args
    */
  getArgs?(): string;
  /**
   * Initialization code for adding options
   */
  init?(cmd: commander.Command): commander.Command | Promise<commander.Command>;
  /**
   * Extra help
   */
  help?(): Promise<string> | string;

  /**
   * Define option
   */
  option<K extends OptionPrimitive, T extends OptionConfig<K>>(cfg: T): T {
    if ('combine' in cfg && cfg.combine && cfg.def && !Array.isArray(cfg.def)) {
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
      combine: (v: K, acc) => choices.includes(v) ? v : acc,
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
      combine: CliUtil.toBool.bind(CliUtil),
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
      combine: CliUtil.toInt.bind(CliUtil, lower, upper),
      ...cfg
    };
  }

  /**
   * Pre-compile on every cli execution
   */
  async build(): Promise<void> {
    await (await import('@travetto/base/bin/lib/'))
      .BuildUtil.build();
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

  /**
   * Render help with additional message or extra text
   */
  async showHelp(err?: string | Error, extra?: string): Promise<never> {
    if (err && typeof err !== 'string') {
      err = err.message;
    }
    HelpUtil.showHelp(this.#cmd, err, extra || (await this.help?.()) || '');
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
    if (this.getArgs) {
      cmd = cmd.arguments(this.getArgs?.());
    }
    for (const cfg of await this.finalizeOptions()) {
      let key = `${cfg.short ? `-${cfg.short}, ` : ''}--${cfg.name}`;
      if (cfg.type !== Boolean || cfg.def) {
        key = `${key} <${cfg.name}>`;
      }
      // @ts-expect-error
      cmd = cfg.combine ? cmd.option(key, cfg.desc, cfg.combine, cfg.def) : cmd.option(key, cfg.desc, (cur, acc) => cur, cfg.def);
    }

    cmd = cmd.action(this.runAction.bind(this));
    return this.#cmd = cmd;
  }

  /**
   * Runs the action at execution time
   */
  async runAction(...args: unknown[]): Promise<void> {
    await this.envInit?.();
    await this.build();
    return await this.action(...args);
  }

  /**
   * Collection tab completion information
   */
  async setupCompletion(config: CompletionConfig): Promise<void> {
    const task = await this.complete();
    config.all = [...config.all, this.name];
    if (task) {
      config.task[this.name] = task;
    }
  }

  /**
   * Return tab completion information
   */
  async complete(): Promise<Completion | void> {
    const out: Completion = { '': [] };
    for (const el of await this.finalizeOptions()) {
      if (el.completion) {
        out[''] = [...out['']!, `--${el.name} `];
        if ('choices' in el && el.choices) {
          out[`--${el.name} `] = el.choices.map(x => `${x}`);
          if (el.short) {
            out[`- ${el.short} `] = el.choices.map(x => `${x}`);
          }
        }
      }
    }
    return out;
  }
}