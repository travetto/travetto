import * as vscode from 'vscode';
import { ActivationTarget } from './types';
import { Workspace } from './workspace';

interface ActivationFactory<T extends ActivationTarget = ActivationTarget> {
  isModule?: boolean;
  new(namespace?: string, sub?: string): T;
}

/**
 * Activation manager
 */
export class ActivationManager {

  static registry = new Set<{ namespace: string, sub?: string, cls: ActivationFactory, instance?: ActivationTarget, module?: boolean }>();

  static async init() {
    for (const entry of [...this.registry.values()]) {
      const { namespace, sub, cls, module } = entry;
      if (!module || (await Workspace.isInstalled(namespace))) {
        entry.instance = new cls(namespace, sub);
      }
    }
  }

  static async activate(ctx: vscode.ExtensionContext) {
    for (const { instance } of this.registry.values()) {
      instance?.activate?.(ctx);
    }
  }

  static async deactivate() {
    for (const { instance } of this.registry.values()) {
      instance?.deactivate?.();
    }
  }
}

export function Activatible(namespace: string, sub?: string) {
  return (cls: ActivationFactory) => { ActivationManager.registry.add({ namespace, sub, cls, module: namespace.startsWith('@travetto') }); };
}