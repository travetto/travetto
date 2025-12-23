import { Class } from '@travetto/runtime';

type OrProm<T> = T | Promise<T>;
type ParsedFlag = { type: 'flag', input: string, array?: boolean, fieldName: string, value?: unknown };
type ParsedArg = { type: 'arg', input: string, array?: boolean, index: number };
type ParsedUnknown = { type: 'unknown', input: string };
type ParsedInput = ParsedUnknown | ParsedFlag | ParsedArg;

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
  main(...args: T): OrProm<undefined | void>;
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
   * Should the invocation run with auto-restart on source changes
   */
  restartForDev?: boolean;
  /**
   * The module to run the command from
   */
  module?: string;
};

/**
 * CLI Command schema shape
 */
export interface CliCommandConfig {
  cls: Class<CliCommandShape>;
  name: string;
  runTarget?: boolean;
  preMain?: (cmd: CliCommandShape) => void | Promise<void>;
}