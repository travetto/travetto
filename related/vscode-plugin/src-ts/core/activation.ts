import * as vscode from 'vscode';

import { IpcSupport } from './ipc';
import { ActivationTarget, TargetEvent } from './types';
import { Workspace } from './workspace';

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

  add(config: ActivationConfig): void {
    this.#registry.add(config);
    if (config.command && typeof config.command === 'string') {
      this.#commandRegistry.set(config.command, config);
    }
  }

  async init(): Promise<void> {
    for (const entry of [...this.#registry.values()]) {
      const { module, command, cls } = entry;
      if (command === true || (await Workspace.isInstalled(`@travetto/${module}`))) {
        entry.instance = new cls(module, command === true ? undefined : command);
        vscode.commands.executeCommand('setContext', `travetto.${module}`, true);
        if (typeof command === 'string') {
          this.#commandRegistry.get(command)!.instance = entry.instance;
          vscode.commands.executeCommand('setContext', `travetto.${module}.${command}`, true);
        }
      }
    }
  }

  async activate(ctx: vscode.ExtensionContext): Promise<void> {
    for (const { instance } of this.#registry.values()) {
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
      console.error('Unknown error', e);
    }
  }
}

export const ActivationManager = new $ActivationManager();

export function Activatible(module: string, command?: string | true) {
  return (cls: ActivationFactory): void => { ActivationManager.add({ module, command, cls }); };
}