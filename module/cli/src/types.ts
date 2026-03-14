import type { Any, Class } from '@travetto/runtime';

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
export interface CliCommandShape {
  /**
   * Action target of the command
   */
  main(...args: unknown[]): OrProm<undefined | void>;
  /**
   * Run before main runs
   */
  finalize?(help?: boolean): OrProm<void>;
  /**
   * Extra help
   */
  help?(): OrProm<string[]>;
}

export type PreMainHandler<T extends Any = Any> = { priority: number, handler: (cmd: T) => Any };

/**
 * CLI Command schema shape
 */
export interface CliCommandConfig {
  cls: Class<CliCommandShape>;
  name: string;
  runTarget?: boolean;
  preMain: PreMainHandler[];
}