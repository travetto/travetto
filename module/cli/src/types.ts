import { Closeable, GlobalEnvConfig } from '@travetto/base';

type OrProm<T> = T | Promise<T>;

type RunResponse = { wait(): Promise<unknown> } | { on(event: 'close', cb: Function): unknown } | Closeable | void | undefined;

/**
 * Constrained version of Schema's Validation Error
 */
export type CliValidationError = {
  /**
   * The error message
   */
  message: string;
  /**
   * The object path of the error
   */
  path: string;
  /**
   * The kind of validation
   */
  kind: string;
};

/**
 * Provides a basic error wrapper for internal try/catch instanceof
 */
export class CliValidationResultError extends Error {
  errors: CliValidationError[];

  constructor(errors: CliValidationError[]) {
    super('');
    this.errors = errors;
  }
}

/**
 * CLI Command Contract
 */
export interface CliCommandShape {
  /**
   * Action target of the command
   */
  main(...args: unknown[]): OrProm<RunResponse>;
  /**
   * Setup environment before command runs
   */
  envInit?(): OrProm<GlobalEnvConfig>;
  /**
   * Extra help
   */
  help?(): OrProm<string[]>;
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
  finalize?(unknownArgs: string[]): OrProm<void>;
  /**
   * Validation method
   */
  validate?(...args: unknown[]): OrProm<CliValidationError | CliValidationError[] | undefined>;
}

/**
 * CLI Command argument/flag shape
 */
export type CliCommandInput = {
  name: string;
  description?: string;
  type: 'string' | 'file' | 'number' | 'boolean' | 'date' | 'regex';
  choices?: unknown[];
  required?: boolean;
  array?: boolean;
  default?: unknown;
  flagNames?: string[];
  envVars?: string[];
};

/**
 * CLI Command schema shape
 */
export type CliCommandSchema = {
  name: string;
  title: string;
  module: string;
  runTarget?: boolean;
  description?: string;
  args: CliCommandInput[];
  flags: CliCommandInput[];
};
