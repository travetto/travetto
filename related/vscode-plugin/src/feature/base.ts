import vscode from 'vscode';

import { Log } from '../core/log.ts';
import { ActivationTarget } from '../core/types.ts';

/**
 * Base feature structure
 */
export abstract class BaseFeature implements ActivationTarget {

  readonly module: string;
  readonly command: string;
  readonly log: Log;

  constructor(
    module?: string,
    command?: string
  ) {
    this.module = module!;
    this.command = command!;
    this.log = new Log([this.moduleBase, this.command].filter(part => !!part).join('.'));
  }

  get moduleBase(): string {
    return this.module.replace('@', '').replace(/[/]/g, '.');
  }

  commandName(task: string): string {
    const prefix = [this.moduleBase, this.command].filter(part => !!part).join('.');
    return `${prefix}:${task}`;
  }

  register(task: string, handler: () => unknown): void {
    this.log.info('Registering command', task);
    vscode.commands.registerCommand(this.commandName(task), handler);
  }
}