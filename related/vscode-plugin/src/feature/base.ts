import * as vscode from 'vscode';

import { RuntimeIndex } from '@travetto/runtime';

import { Log } from '../core/log.ts';
import type { ActivationTarget, ActivationTargetConfig } from '../core/types.ts';
import { Workspace } from '../core/workspace.ts';

/**
 * Base feature structure
 */
export abstract class BaseFeature implements ActivationTarget {
  readonly module: string;
  readonly command: string;
  readonly log: Log;
  readonly priority?: number;
  readonly alwaysActivate?: boolean;

  constructor(config: ActivationTargetConfig) {
    Object.assign(this, config);
    this.log = new Log(this.moduleCommand);
  }

  get moduleBase(): string {
    return this.module.replace('@', '').replace(/[/]/g, '.');
  }

  get moduleCommand(): string {
    return this.command ? `${this.moduleBase}.${this.command}` : this.moduleBase;
  }

  get available(): boolean {
    if (this.alwaysActivate) {
      return true;
    }
    try {
      Workspace.resolveImport(this.module);
      return true;
    } catch {}
    return RuntimeIndex.hasModule(this.module) ?? false;
  }

  register(task: string, handler: () => unknown): void {
    this.log.info('Registering command', task);
    vscode.commands.registerCommand(`${this.moduleCommand}:${task}`, handler);
  }
}
