import * as vscode from 'vscode';

import { IpcSupport } from './ipc.ts';
import { ActivationTarget, TargetEvent, type ActivationTargetConfig } from './types.ts';
import { Workspace } from './workspace.ts';
import { Log } from './log.ts';
import { RuntimeIndex } from '@travetto/runtime';

interface ActivationFactory<T extends ActivationTarget = ActivationTarget> {
  new(cfg: ActivationTargetConfig): T;
}

/**
 * Activation manager
 */
class $ActivationManager {

  static #isInstalled(module: string): boolean {
    try { Workspace.resolveImport(module); return true; } catch { return false; }
  }

  static #isPackaged(module: string): boolean {
    return RuntimeIndex.hasModule(module) ?? false;
  }

  #registry = new Set<ActivationTarget>();
  #commandRegistry = new Map<string, ActivationTarget>();
  #ipcSupport = new IpcSupport(event => this.onTargetEvent(event));
  #log = new Log('travetto.vscode.activation');

  add(cls: ActivationFactory, config: ActivationTargetConfig): void {
    const instance = new cls({
      isInstalled: $ActivationManager.#isInstalled(config.module),
      isPackaged: $ActivationManager.#isPackaged(config.module),
      ...config,
      priority: config.priority ?? 100,
    });

    this.#registry.add(instance);
    if (config.command && typeof config.command === 'string') {
      this.#commandRegistry.set(`${config.module}:${config.command}`, instance);
    }
  }

  async init(): Promise<void> {
    for (const instance of this.#registry.values()) {
      await vscode.commands.executeCommand('setContext', instance.moduleBase, true);
      await vscode.commands.executeCommand('setContext', `${instance.moduleBase}.${instance.command}`, true);
    }
  }

  async activate(ctx: vscode.ExtensionContext): Promise<void> {
    const byPriority = [...this.#registry.values()]
      .toSorted((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
    let hasIpcActivated = false;
    for (const instance of byPriority) {
      if (instance.active) {
        this.#log.info('Activating', instance.module, instance.command);
        await instance.activate?.(ctx);
        hasIpcActivated ||= instance.onEvent !== undefined;
      }
    }
    if (hasIpcActivated) {
      await this.#ipcSupport.activate(ctx);
    }
  }

  async deactivate(): Promise<void> {
    this.#ipcSupport.deactivate();
    for (const instance of this.#registry.values()) {
      instance.deactivate?.();
    }
  }

  async onTargetEvent(event: TargetEvent): Promise<void> {
    try {
      const handler = await this.#commandRegistry.get(event.type);
      if (handler?.onEvent) {
        await handler.onEvent(event);
        await vscode.window.activeTerminal?.show();
      } else {
        this.#log.warn('Unknown event type', event.type, event);
      }
    } catch (error) {
      this.#log.error('Unknown error', error);
    }
  }
}

export const ActivationManager = new $ActivationManager();

export function Activatible(config: ActivationTargetConfig) {
  return (cls: ActivationFactory): void => {
    ActivationManager.add(cls, config);
  };
}
