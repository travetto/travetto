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
  activate?(ctx: vscode.ExtensionContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
  onEvent?(event: TargetEvent): void | Promise<void>;
}