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
export class ActivationManager {

  static #registry = new Set<ActivationConfig>();
  static #commandRegistry = new Map<string, ActivationConfig>();
  static #ipcSupport = new IpcSupport(e => this.onTargetEvent(e));

  static add(config: ActivationConfig): void {
    this.#registry.add(config);
    if (config.command && typeof config.command === 'string') {
      this.#commandRegistry.set(config.command, config);
    }
  }

  static async init(): Promise<void> {
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

  static async activate(ctx: vscode.ExtensionContext): Promise<void> {
    for (const { instance } of this.#registry.values()) {
      instance?.activate?.(ctx);
    }
    this.#ipcSupport.activate(ctx);
  }

  static async deactivate(): Promise<void> {
    this.#ipcSupport.deactivate();
    for (const { instance } of this.#registry.values()) {
      instance?.deactivate?.();
    }
  }

  static async onTargetEvent(event: TargetEvent): Promise<void> {
    try {
      await this.#commandRegistry.get(event.type)?.instance?.onEvent?.(event);
      await vscode.window.activeTerminal?.show();
    } catch (e) {
      console.error('Unknown error', e);
    }
  }
}

export function Activatible(module: string, command?: string | true) {
  return (cls: ActivationFactory): void => { ActivationManager.add({ module, command, cls }); };
}