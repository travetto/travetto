import * as vscode from 'vscode';

/**
 * Shape of an activation target
 */
export interface ActivationTarget {
  module: string;
  command?: string;
  activate?(ctx: vscode.ExtensionContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}

/**
 * Parameter configuration
 */
export interface FieldConfig {
  title?: string;
  description?: string;
  name: string;
  aliases?: string[];
  type: string;
  index?: number;
  array: boolean;
  specifier?: string;
  precision?: [number, number] | [number, undefined];
  required?: { active: boolean, message?: string };
  match?: { re: RegExp, message?: string };
  min?: { n: number | Date, message?: string };
  max?: { n: number | Date, message?: string };
  minlength?: { n: number, message?: string };
  maxlength?: { n: number, message?: string };
  enum?: { values: (string | number | boolean)[], message: string };
  default?: number | string | boolean | null;
}
