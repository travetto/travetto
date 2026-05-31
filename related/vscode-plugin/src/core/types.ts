import type vscode from 'vscode';

export type TargetEvent<T = unknown> = {
  type: string;
  data: T;
};

/**
 * Shape of an activation target configuration
 */
export interface ActivationTargetConfig {
  module: string;
  command: string;
  priority?: number;
  isInstalled?: boolean;
  isPackaged?: boolean;
  alwaysActivate?: boolean;
}

/**
 * Shape of an activation target
 */
export interface ActivationTarget extends ActivationTargetConfig {
  moduleBase: string;
  active: boolean;
  activate?(ctx: vscode.ExtensionContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
  onEvent?(event: TargetEvent): void | Promise<void>;
}

export type EnvDict = Record<string, string | undefined>;

export type LaunchConfig = {
  useCli?: boolean;
  module?: string;
  cwd?: string;
  name: string;
  main: string;
  args?: string[];
  env?: EnvDict;
};