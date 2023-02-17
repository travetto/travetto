import vscode from 'vscode';

import { Log } from '../core/log';
import { ActivationTarget } from '../core/types';

/**
 * Base feature structure
 */
export abstract class BaseFeature implements ActivationTarget {

  public readonly module: string;
  public readonly command: string;
  public readonly log: Log;

  constructor(
    module?: string,
    command?: string
  ) {
    this.module = module!;
    this.command = command!;
    this.log = new Log([this.moduleBase, this.command].filter(x => !!x).join('.'));
  }

  get moduleBase(): string {
    return this.module.replace('@', '').replace(/[/]/g, '.');
  }

  commandName(task: string): string {
    const prefix = [this.moduleBase, this.command].filter(x => !!x).join('.');
    return `${prefix}:${task}`;
  }

  register(task: string, handler: () => unknown): void {
    this.log.info('Registering command', this.commandName(task));
    vscode.commands.registerCommand(this.commandName(task), handler);
  }
}