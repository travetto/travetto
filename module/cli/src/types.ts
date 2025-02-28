import { Class } from '@travetto/runtime';

type OrProm<T> = T | Promise<T>;

export type RunResponse =
  { wait(): Promise<unknown> } |
  { on(event: 'close', cb: Function): unknown } |
  { close: () => (void | Promise<void>) } | void | undefined;

type ParsedFlag = { type: 'flag', input: string, array?: boolean, fieldName: string, value?: unknown };
type ParsedArg = { type: 'arg', input: string, array?: boolean, index: number };
type ParsedUnknown = { type: 'unknown', input: string };
type ParsedInput = ParsedUnknown | ParsedFlag | ParsedArg;

/**
 * Command configuration
 */
export type CliCommandConfig = {
  name: string;
  commandModule: string;
  runTarget?: boolean;
  cls: Class<CliCommandShape>;
  hidden?: boolean;
  preMain?: (cmd: CliCommandShape) => void | Promise<void>;
};

export type ParsedState = {
  inputs: string[];
  all: ParsedInput[];
  flags: ParsedFlag[];
  unknown: string[];
};

/**
 * Constrained version of Schema's Validation Error
 * @concrete
 */
export interface CliValidationError {
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
 * @concrete
 */
export interface CliCommandShape<T extends unknown[] = unknown[]> {

  /**
   * Parsed state
   */
  _parsed?: ParsedState;
  /**
   * Config
   */
  _cfg?: CliCommandConfig;
  /**
   * Action target of the command
   */
  main(...args: T): OrProm<RunResponse>;
  /**
   * Run before main runs
   */
  preMain?(): OrProm<void>;
  /**
   * Extra help
   */
  help?(): OrProm<string[]>;
  /**
   * Run before help is displayed
   */
  preHelp?(): OrProm<void>;
  /**
   * Is the command active/eligible for usage
   */
  isActive?(): boolean;
  /**
   * Run before binding occurs
   */
  preBind?(): OrProm<void>;
  /**
   * Run before validation occurs
   */
  preValidate?(): OrProm<void>;
  /**
   * Validation method
   */
  validate?(...args: T): OrProm<CliValidationError | CliValidationError[] | undefined>;
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
export type CliCommandInput<K extends string = string> = {
  name: string;
  description?: string;
  type: 'string' | 'file' | 'number' | 'boolean' | 'date' | 'regex' | 'module';
  fileExtensions?: string[];
  choices?: unknown[];
  required?: boolean;
  array?: boolean;
  default?: unknown;
  flagNames?: K[];
  envVars?: string[];
};

/**
 * CLI Command schema shape
 */
export interface CliCommandSchema<K extends string = string> {
  name: string;
  title: string;
  commandModule: string;
  runTarget?: boolean;
  description?: string;
  args: CliCommandInput[];
  flags: CliCommandInput<K>[];
}
