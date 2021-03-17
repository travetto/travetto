import * as vscode from 'vscode';

import { ActivationTarget } from '../core/types';

/**
 * Base feature structure
 */
export abstract class BaseFeature implements ActivationTarget {

  public readonly module: string;
  public readonly command: string;

  constructor(
    module?: string,
    command?: string
  ) {
    this.module = module!;
    this.command = command!;
  }

  get commandBase() {
    return `travetto.${this.module}.${this.command}`;
  }

  commandName(task: string) {
    return `${this.commandBase}:${task}`;
  }

  register(task: string, handler: () => unknown) {
    vscode.commands.registerCommand(this.commandName(task), handler);
  }
}