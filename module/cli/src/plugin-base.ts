import * as commander from 'commander';
import { CompletionConfig } from './types';
import { HelpUtil } from './help';

type Completion = Record<string, string[]>;

/**
 * Base plugin
 */
export abstract class BasePlugin {
  /**
   * Command object
   */
  _cmd: commander.Command;

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
    cmd = cmd.action(this.action.bind(this));
    return this._cmd = cmd;
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