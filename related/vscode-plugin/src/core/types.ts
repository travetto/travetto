import type vscode from 'vscode';

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

export type EnvDict = Record<string, string | undefined>;

export type LaunchConfig = {
  useCli?: boolean;
  module?: string;
  name: string;
  main: string;
  args?: string[];
  env?: EnvDict;
};