import * as vscode from 'vscode';

export type TargetEvent<T = unknown> = {
  type: string;
  data: T;
};

/**
 * Shape of an activation target
 */
export interface ActivationTarget {
  module: string;
  command?: string;
  moduleBase: string;
  activate?(ctx: vscode.ExtensionContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
  onEvent?(event: TargetEvent): void | Promise<void>;
}

export type LaunchConfig = {
  useCli?: boolean;
  cliModule?: string;
  name: string;
  main: string;
  args?: string[];
  env?: Record<string, string>;
};