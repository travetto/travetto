import * as vscode from 'vscode';

/**
 * Shape of an activation target
 */
export interface ActivationTarget {
  activate?(ctx: vscode.ExtensionContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}

/**
 * Parameter configuration
 */
export interface ParamConfig {
  name: string;
  title?: string;
  type?: string;
  subtype?: string;
  def?: string | boolean | number;
  optional?: boolean;
  meta?: any;
}
