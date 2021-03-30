import * as commander from 'commander';

import { CompletionConfig } from './types';
import { HelpUtil } from './help';

type Completion = Record<string, string[]>;

/**
 * Base plugin
 */
export abstract class BasePlugin<T = unknown> {
  /**
   * Command object
   */
  _cmd: commander.Command;

  /**
   * Setup environment before plugin runs
   */
  envInit?(): Promise<void> | void;

  /**
   * Pre-compile on every cli execution
   */
  async build?() {
    await (await import('@travetto/base/bin/lib/'))
      .BuildUtil.build();
  }

  get opts(): T {
    return this._cmd.opts() as T;
  }

  /**
   * CLI command name
   */
  abstract get name(): string;

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
    HelpUtil.showHelp(this._cmd, err, extra || await this.help());
  }

  /**
   * Receive the commander object, and process
   */
  async setup(cmd: commander.Command) {
    cmd = cmd.command(this.name);
    cmd = await this.init(cmd);
    cmd = cmd.action(this.runAction.bind(this));
    return this._cmd = cmd;
  }

  /**
   * Runs the action at execution time
   */
  async runAction(...args: unknown[]) {
    if (this.envInit) {
      await this.envInit();
    }
    if (this.build) {
      await this.build();
    }
    return await this.action(...args);
  }

  /**
   * Collection tab completion information
   */
  async setupCompletion(config: CompletionConfig) {
    const task = await this.complete();
    config.all.push(this.name);
    if (task) {
      config.task[this.name] = task;
    }
  }

  /**
   * Initialization code for adding options
   */
  abstract init(cmd: commander.Command): commander.Command | Promise<commander.Command>;

  /**
   * Action target of the command
   * @param args Cli args
   */
  abstract action(...args: unknown[]): void | Promise<void>;

  /**
   * Return tab completion information
   */
  complete(): Promise<Completion | void> | Completion | void { }
}