import { GlobalEnvConfig } from '@travetto/base';
import { ValidationError } from '@travetto/schema';

/**
 * Base command
 */
export interface CliCommandShape {
  /**
   * Action target of the command
   */
  main(...args: unknown[]): void | Promise<void>;
  /**
   * Setup environment before command runs
   */
  envInit?(): Promise<GlobalEnvConfig> | GlobalEnvConfig;
  /**
   * Extra help
   */
  help?(): Promise<string> | string;
  /**
   * Supports JSON IPC?
   */
  jsonIpc?(...args: unknown[]): Promise<unknown>;
  /**
   * Is the command active/eligible for usage
   */
  isActive?(): boolean;
  /**
   * Run before binding occurs
   */
  initializeFlags?(): void | Promise<void>;
  /**
   * Run before validation occurs
   */
  finalizeFlags?(): void | Promise<void>;
  /**
   * Validation method
   */
  validate?(...args: unknown[]): Promise<ValidationError | ValidationError[] | undefined> | ValidationError | ValidationError[] | undefined;
}

export type CliCommandInput = {
  name: string;
  description?: string;
  type: 'string' | 'number' | 'boolean' | 'regex';
  choices?: unknown[];
  required?: boolean;
  array?: boolean;
  default?: unknown;
  flagNames?: string[];
};

export type CliCommandSchema = {
  title: string;
  args: CliCommandInput[];
  flags: CliCommandInput[];
};
