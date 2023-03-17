import vscode from 'vscode';

import { IpcSupport } from './ipc';
import { ActivationTarget, TargetEvent } from './types';
import { Workspace } from './workspace';
import { Log } from './log';

interface ActivationFactory<T extends ActivationTarget = ActivationTarget> {
  new(module: string, command?: string): T;
}

type ActivationConfig = { module: string, command?: string | true, cls: ActivationFactory, instance?: ActivationTarget };

/**
 * Activation manager
 */
class $ActivationManager {

  #registry = new Set<ActivationConfig>();
  #commandRegistry = new Map<string, ActivationConfig>();
  #ipcSupport = new IpcSupport(e => this.onTargetEvent(e));
  #log = new Log('travetto.vscode.activation');

  add(config: ActivationConfig): void {
    this.#registry.add(config);
    if (config.command && typeof config.command === 'string') {
      this.#commandRegistry.set(`${config.module}:${config.command}`, config);
    }
  }

  async init(): Promise<void> {
    for (const entry of [...this.#registry.values()]) {
      const { module, command, cls } = entry;
      if (command === true || (await Workspace.isInstalled(module))) {
        const inst = entry.instance = new cls(module, command === true ? undefined : command);
        await vscode.commands.executeCommand('setContext', inst.moduleBase, true);
        if (typeof command === 'string') {
          this.#commandRegistry.get(`${module}:${command}`)!.instance = entry.instance;
          await vscode.commands.executeCommand('setContext', `${inst.moduleBase}.${command}`, true);
        }
      }
    }
  }

  async activate(ctx: vscode.ExtensionContext): Promise<void> {
    for (const { instance } of this.#registry.values()) {
      this.#log.info('Activating', instance?.module, instance?.command);
      instance?.activate?.(ctx);
    }
    this.#ipcSupport.activate(ctx);
  }

  async deactivate(): Promise<void> {
    this.#ipcSupport.deactivate();
    for (const { instance } of this.#registry.values()) {
      instance?.deactivate?.();
    }
  }

  async onTargetEvent(event: TargetEvent): Promise<void> {
    try {
      await this.#commandRegistry.get(event.type)?.instance?.onEvent?.(event);
      await vscode.window.activeTerminal?.show();
    } catch (e) {
      this.#log.error('Unknown error', e);
    }
  }
}

export const ActivationManager = new $ActivationManager();

export function Activatible(module: string, command?: string | true) {
  return (cls: ActivationFactory): void => { ActivationManager.add({ module, command, cls }); };
}