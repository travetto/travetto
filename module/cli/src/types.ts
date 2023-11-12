import { Closeable, EnvInit } from '@travetto/base';

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
   * Source of validation
   */
  source?: 'flag' | 'arg' | 'custom';
};

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
  envInit?(): OrProm<EnvInit>;
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
  validate?(...unknownArgs: unknown[]): OrProm<CliValidationError | CliValidationError[] | undefined>;
}

/**
 * Command shape common fields
 */
export type CliCommandShapeFields = {
  /**
   * Environment to run in
   */
  env?: string;
  /**
   * Should the cli invocation trigger a debug session, via IPC
   */
  debugIpc?: boolean;
  /**
   * Should the invocation run with auto-restart
   */
  canRestart?: boolean;
  /**
   * The module to run the command from
   */
  module?: string;
};

/**
 * CLI Command argument/flag shape
 */
export type CliCommandInput = {
  name: string;
  description?: string;
  type: 'string' | 'file' | 'number' | 'boolean' | 'date' | 'regex';
  fileExtensions?: string[];
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
  commandModule: string;
  runTarget?: boolean;
  description?: string;
  args: CliCommandInput[];
  flags: CliCommandInput[];
};
