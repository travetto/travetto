import vscode from 'vscode';

import { ActivationTarget } from '../core/types';
import { Workspace } from '../core/workspace';

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

  get commandBase(): string {
    return `${this.module.replace('@', '').replace(/[/]/g, '.')}.${this.command}`;
  }

  commandName(task: string): string {
    return `${this.commandBase}:${task}`;
  }

  register(task: string, handler: () => unknown): void {
    console.log('Registering command', this.commandName(task));
    vscode.commands.registerCommand(this.commandName(task), handler);
  }

  resolveImport(rel: string): string {
    return Workspace.workspaceIndex.resolveFileImport(`${this.module}/${rel}`);
  }
}