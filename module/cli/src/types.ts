import type { Class } from '@travetto/runtime';

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
  finalize?(help?: boolean): OrProm<void>;
  /**
   * Extra help
   */
  help?(): OrProm<string[]>;
}

/**
 * Command shape common fields
 */
export type CliCommandShapeFields = {
  /**
   * Profiles to run the application under
   */
  profiles?: string[];
  /**
   * Should the cli invocation trigger a debug session, via IPC
   */
  debugIpc?: boolean;
  /**
   * Should the invocation run with auto-restart on source changes
   */
  restartOnChange?: boolean;
  /**
   * The module to run the command from
   */
  module?: string;
};

type PreMainHandler = (cmd: CliCommandShape) => (unknown | Promise<unknown>);

/**
 * CLI Command schema shape
 */
export interface CliCommandConfig {
  cls: Class<CliCommandShape>;
  name: string;
  runTarget?: boolean;
  preMain?: PreMainHandler[];
}