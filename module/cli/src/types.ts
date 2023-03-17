import { Class, GlobalEnvConfig } from '@travetto/base';

type OrProm<T> = T | Promise<T>;

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

export class CliValidationResultError extends Error {
  errors: CliValidationError[];

  constructor(errors: CliValidationError[]) {
    super('');
    this.errors = errors;
  }
}

export const CliCommandMetaⲐ = Symbol.for('@travetto/cli:command-meta');

/**
 * Base command
 */
export interface CliCommandShape {
  /** Metadata */
  [CliCommandMetaⲐ]?: {
    name: string;
    module: string;
    cls: Class<CliCommandShape>;
  };

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
  finalize?(unknownArgs: string[]): OrProm<void>;
  /**
   * Validation method
   */
  validate?(...args: unknown[]): OrProm<CliValidationError | CliValidationError[] | undefined>;
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
  name: string;
  title: string;
  module: string;
  description?: string;
  args: CliCommandInput[];
  flags: CliCommandInput[];
};
