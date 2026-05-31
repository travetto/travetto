import * as vscode from 'vscode';

import { Log } from '../core/log.ts';
import { ActivationTarget, type ActivationTargetConfig } from '../core/types.ts';

/**
 * Base feature structure
 */
export abstract class BaseFeature implements ActivationTarget {

  readonly module: string;
  readonly command: string;
  readonly log: Log;
  readonly isInstalled?: boolean;
  readonly isPackaged?: boolean;
  readonly priority?: number;
  readonly alwaysActivate?: boolean;

  constructor(config: ActivationTargetConfig) {
    Object.assign(this, config);
    this.log = new Log([this.moduleBase, this.command].filter(part => !!part).join('.'));
  }

  get moduleBase(): string {
    return this.module.replace('@', '').replace(/[/]/g, '.');
  }

  get active(): boolean {
    return (this.alwaysActivate ?? false)
      || (this.isInstalled ?? false)
      || (this.isPackaged ?? false);
  }

  commandName(task: string): string {
    return `${this.moduleBase}.${this.command}:${task}`;
  }

  register(task: string, handler: () => unknown): void {
    this.log.info('Registering command', task);
    vscode.commands.registerCommand(this.commandName(task), handler);
  }
}