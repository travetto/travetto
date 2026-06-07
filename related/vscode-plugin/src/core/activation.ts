import * as vscode from 'vscode';

import { IpcSupport } from './ipc.ts';
import { ActivationTarget, TargetEvent, type ActivationTargetConfig } from './types.ts';
import { Log } from './log.ts';

interface ActivationFactory<T extends ActivationTarget = ActivationTarget> {
  new(cfg: ActivationTargetConfig): T;
}

/**
 * Activation manager
 */
class $ActivationManager {

  #registry = new Set<ActivationTarget>();
  #commandRegistry = new Map<string, ActivationTarget>();
  #ipcSupport = new IpcSupport(event => this.onTargetEvent(event));
  #log = new Log('travetto.vscode.activation');

  add(cls: ActivationFactory, config: ActivationTargetConfig): void {
    const resolved = {
      ...config,
      priority: config.priority ?? 100,
    } as const;

    this.#log.info('Registering activation target', `${resolved.module}.${resolved.command}`, resolved);

    const instance = new cls(resolved);

    this.#registry.add(instance);
    if (config.command && typeof config.command === 'string') {
      this.#commandRegistry.set(instance.moduleCommand, instance);
    }
  }

  async activate(ctx: vscode.ExtensionContext): Promise<void> {
    const byPriority = [...this.#registry.values()]
      .toSorted((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
    let hasIpcActivated = false;
    for (const instance of byPriority) {
      if (instance.available) {
        this.#log.info('Activating', instance.module, instance.command);
        await vscode.commands.executeCommand('setContext', instance.moduleBase, true);
        await vscode.commands.executeCommand('setContext', instance.moduleCommand, true);
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
