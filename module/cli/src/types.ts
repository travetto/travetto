import { GlobalEnvConfig } from '@travetto/base';
import { ValidationError } from '@travetto/schema';

type OrProm<T> = T | Promise<T>;

/**
 * Base command
 */
export interface CliCommandShape {
  /**
   * Action target of the command
   */
  main(...args: unknown[]): OrProm<void>;
  /**
   * Setup environment before command runs
   */
  envInit?(): OrProm<GlobalEnvConfig>;
  /**
   * Extra help
   */
  help?(): OrProm<string>;
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
  initialize?(): OrProm<void>;
  /**
   * Run before validation occurs
   */
  finalize?(unknownArgs?: string[]): OrProm<void>;
  /**
   * Validation method
   */
  validate?(...args: unknown[]): OrProm<ValidationError | ValidationError[] | undefined>;
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
