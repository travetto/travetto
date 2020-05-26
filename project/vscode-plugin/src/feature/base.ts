import * as vscode from 'vscode';

import { ActivationTarget } from '../core/types';
import { Workspace } from '../core/workspace';
import { ExecUtil } from '@travetto/boot';

// @ts-ignore
export abstract class BaseFeature implements ActivationTarget {

  static isModule = true;

  constructor(
    private module?: string,
    private command?: string
  ) {
    const ctxRoot = this.module!.replace('@', '').replace(/\/+/g, '.');
    vscode.commands.executeCommand('setContext', `${ctxRoot}.${this.command}`, true);
    vscode.commands.executeCommand('setContext', ctxRoot, true);
  }

  resolve(...rel: string[]) {
    if (this.module === Workspace.getModule()) {
      return Workspace.resolve(...rel);
    } else {
      return Workspace.resolve('node_modules', this.module!, ...rel);
    }
  }

  resolvePlugin(name: string) {
    return this.resolve('bin', `travetto-plugin-${name}.js`);
  }

  async runPlugin(name: string) {
    const { result } = ExecUtil.fork(this.resolvePlugin(name), [], {
      cwd: Workspace.path
    });
    const output = await result;
    return output.stdout;
  }

  commandName(task: string) {
    return `${this.module!.replace('@', '').replace(/\/+/g, '.')}.${this.command}:${task}`;
  }

  register(task: string, handler: () => any) {
    vscode.commands.registerCommand(this.commandName(task), handler);
  }
}