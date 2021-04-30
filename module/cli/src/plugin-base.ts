import * as commander from 'commander';

import { CompletionConfig } from './types';
import { HelpUtil } from './help';
import { CliUtil } from './util';

type Completion = Record<string, string[]>;

type ParamConfig<K> = {
  type?: Function;
  key?: string;
  short?: string | false;
  name?: string;
  desc: string;
  completion?: boolean;
  def?: K;
  choices?: K[];
  combine?: (v: string, curr: K) => K;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParamMap<T = any> = { [key in keyof T]: ParamConfig<T[key]> };

type Shape<M extends ParamMap> = { [k in keyof M]: Exclude<M[k]['def'], undefined> };

/**
 * Base plugin
 */
export abstract class BasePlugin<V extends ParamMap = ParamMap> {
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
   * Setup environment before plugin runs
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
   * Define option
   */
  option(cfg: ParamConfig<string>): ParamConfig<string> {
    if (cfg.combine && cfg.def) {
      cfg.def = cfg.combine(cfg.def, cfg.def);
    }
    return { type: String, ...cfg };
  }

  /**
   * Define option
   */
  choiceOption<K>({ choices, ...cfg }: ParamConfig<string> & { choices: K[] | readonly K[] }): ParamConfig<K> {
    return {
      type: String,
      combine: (v, acc) => choices.includes(v as unknown as K) ? v as unknown as K : acc,
      choices,
      completion: true,
      ...cfg
    } as ParamConfig<K>;
  }

  /**
   * Define list option
   */
  listOption(cfg: ParamConfig<string[]>): ParamConfig<string[]> {
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
  boolOption(cfg: ParamConfig<boolean>): ParamConfig<boolean> {
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
  intOption({ lower, upper, ...cfg }: ParamConfig<number> & { lower?: number, upper?: number }): ParamConfig<number> {
    return {
      type: Number,
      combine: CliUtil.toInt.bind(CliUtil, lower, upper),
      ...cfg
    };
  }

  /**
   * Pre-compile on every cli execution
   */
  async build() {
    await (await import('@travetto/base/bin/lib/'))
      .BuildUtil.build();
  }

  get cmd() {
    return this.#cmd.opts() as Shape<ReturnType<Exclude<this['getOptions'], undefined>>>;
  }

  /**
   * Extra help
   */
  async help() {
    return '';
  }

  /**
   * Render help with additional message or extra text
   */
  async showHelp(err?: string | Error, extra?: string): Promise<never> {
    if (err && typeof err !== 'string') {
      err = err.message;
    }
    HelpUtil.showHelp(this.#cmd, err, extra || await this.help());
  }

  /**
   * Process all options into final set before registering with commander
   * @returns
   */
  async finalizeOptions() {
    const opts = this.getOptions?.() ?? {};
    const used = new Set();

    return Object.entries(opts as ParamMap).map(([k, cfg]) => {
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
  async setup(cmd: commander.Command) {
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
      cmd = cfg.combine ? cmd.option(key, cfg.desc, cfg.combine, cfg.def) : cmd.option(key, cfg.desc, cfg.def);
    }

    cmd = cmd.action(this.runAction.bind(this));
    return this.#cmd = cmd;
  }

  /**
   * Runs the action at execution time
   */
  async runAction(...args: unknown[]) {
    await this.envInit?.();
    await this.build();
    return await this.action(...args);
  }

  /**
   * Collection tab completion information
   */
  async setupCompletion(config: CompletionConfig) {
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
    const out: Completion = {
      '': [] as string[]
    };
    for (const el of await this.finalizeOptions()) {
      if (el.completion) {
        out[''] = [...out['']!, `--${el.name} `];
        if (el.choices) {
          out[`--${el.name} `] = el.choices;
          if (el.short) {
            out[`- ${el.short} `] = el.choices;
          }
        }
      }
    }
    return out;
  }
}