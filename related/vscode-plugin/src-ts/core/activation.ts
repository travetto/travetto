import * as vscode from 'vscode';

import { ActivationTarget } from './types';
import { Workspace } from './workspace';

interface ActivationFactory<T extends ActivationTarget = ActivationTarget> {
  new(module: string, comand?: string): T;
}

type ActivationConfig = { module: string, command?: string | true, cls: ActivationFactory, instance?: ActivationTarget };

/**
 * Activation manager
 */
export class ActivationManager {

  static #registry = new Set<ActivationConfig>();

  static add(config: ActivationConfig) {
    this.#registry.add(config);
  }

  static async init() {
    for (const entry of [...this.#registry.values()]) {
      const { module, command, cls } = entry;
      if (command === true || (await Workspace.isInstalled(`@travetto/${module}`))) {
        entry.instance = new cls(module, command === true ? undefined : command);
        vscode.commands.executeCommand('setContext', `travetto.${module}`, true);
        if (typeof command === 'string') {
          vscode.commands.executeCommand('setContext', `travetto.${module}.${command}`, true);
        }
      }
    }
  }

  static async activate(ctx: vscode.ExtensionContext) {
    for (const { instance } of this.#registry.values()) {
      instance?.activate?.(ctx);
    }
  }

  static async deactivate() {
    for (const { instance } of this.#registry.values()) {
      instance?.deactivate?.();
    }
  }
}

export function Activatible(module: string, command?: string | true) {
  return (cls: ActivationFactory) => { ActivationManager.add({ module, command, cls }); };
}