import * as vscode from 'vscode';

import { ExecUtil } from '@travetto/boot';

import { ActivationTarget } from '../core/types';
import { Workspace } from '../core/workspace';

/**
 * Base feature structure
 */
export abstract class BaseFeature implements ActivationTarget {

  static isModule = true;

  public readonly module: string;
  public readonly command: string;

  constructor(
    module?: string,
    command?: string
  ) {
    this.module = module!;
    this.command = command!;
    const ctxRoot = this.module.replace('@', '').replace(/\/+/g, '.');
    vscode.commands.executeCommand('setContext', `${ctxRoot}.${this.command}`, true);
    vscode.commands.executeCommand('setContext', ctxRoot, true);
  }

  resolve(...rel: string[]) {
    if (this.module === Workspace.getModule()) {
      return Workspace.resolve(...rel);
    } else {
      return Workspace.resolve('node_modules', this.module, ...rel);
    }
  }

  resolveBin(name: string) {
    return this.resolve('bin', name);
  }

  async build() {
    const { result } = ExecUtil.forkMain(Workspace.resolve('node_modules/@travetto/base/bin/build'), [], {
      cwd: Workspace.path,
    });

    try {
      return await Promise.race([result, new Promise((res, rej) => setTimeout(rej, 500))]);
    } catch (err) { // Handle timeout
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Building...',
        cancellable: false
      }, () => result);
      return (await result).stdout;
    }
  }

  async runBin(name: string) {
    const { result } = ExecUtil.forkMain(this.resolveBin(name), [], {
      cwd: Workspace.path
    });
    const output = await result;
    return output.stdout;
  }

  runBinJSON<T = unknown>(name: string) {
    return this.runBin(name).then(x => JSON.parse(x) as T);
  }

  commandName(task: string) {
    return `${this.module.replace('@', '').replace(/\/+/g, '.')}.${this.command}:${task}`;
  }

  register(task: string, handler: () => unknown) {
    vscode.commands.registerCommand(this.commandName(task), handler);
  }
}