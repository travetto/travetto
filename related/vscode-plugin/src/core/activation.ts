import vscode from 'vscode';

import { IpcSupport } from './ipc';
import { ActivationTarget, TargetEvent } from './types';
import { Workspace } from './workspace';
import { Log } from './log';

interface ActivationFactory<T extends ActivationTarget = ActivationTarget> {
  new(module: string, command?: string): T;
}

type ActivationConfig = { module: string, command?: string | true, cls: ActivationFactory, instance?: ActivationTarget, priority: number };

/**
 * Activation manager
 */
class $ActivationManager {

  static #isInstalled(mod: string): boolean | undefined {
    try { Workspace.resolveImport(mod); return true; } catch { }
  }

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
      if (command === true || $ActivationManager.#isInstalled(module)) {
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
    for (const { instance } of [...this.#registry.values()].sort((a, b) => a.priority - b.priority)) {
      this.#log.info('Activating', instance?.module, instance?.command);
      await instance?.activate?.(ctx);
    }
    await this.#ipcSupport.activate(ctx);
  }

  async deactivate(): Promise<void> {
    this.#ipcSupport.deactivate();
    for (const { instance } of this.#registry.values()) {
      instance?.deactivate?.();
    }
  }

  async onTargetEvent(event: TargetEvent): Promise<void> {
    try {
      const handler = await this.#commandRegistry.get(event.type)?.instance;
      if (handler && handler.onEvent) {
        await handler.onEvent(event);
        await vscode.window.activeTerminal?.show();
      } else {
        this.#log.warn('Unknown event type', event.type, event);
      }
    } catch (e) {
      this.#log.error('Unknown error', e);
    }
  }
}

export const ActivationManager = new $ActivationManager();

export function Activatible(module: string, command?: string | true, priority = 100) {
  return (cls: ActivationFactory): void => { ActivationManager.add({ module, command, cls, priority }); };
}