/* eslint-disable @typescript-eslint/no-explicit-any */
export type Class<T = any> = abstract new (...args: any[]) => T;
export type ConcreteClass<T = any> = new (...args: any[]) => T;
export type ClassInstance<T = any> = T & {
  constructor: ConcreteClass<T> & { Ⲑid: string };
};

export type Primitive = number | boolean | string | Date | Error;

export type LogLevel = 'info' | 'warn' | 'debug' | 'error';

export type ConsoleEvent = {
  /** Time of event */
  timestamp: Date;
  /** The level of the console event */
  level: LogLevel;
  /** The source file of the event */
  source: string;
  /** The line number the console event was triggered from */
  line: number;
  /** The module name for the source file */
  module: string;
  /** The module path  for the source file*/
  modulePath: string;
  /** The computed scope for the console. statement.  */
  scope?: string;
  /** Arguments passed to the console call*/
  args: unknown[];
};

export interface ConsoleListener {
  onLog(ev: ConsoleEvent): void;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type MethodDescriptor<R = any, V = unknown> = TypedPropertyDescriptor<(this: V, ...params: any[]) => R>;

export const TypedObject: {
  keys<T = unknown, K extends keyof T = keyof T>(o: T): K[];
  fromEntries<K extends string | symbol, V>(items: ([K, V] | readonly [K, V])[]): Record<K, V>;
  entries<K extends Record<symbol | string, unknown>>(record: K): [keyof K, K[keyof K]][];
} & ObjectConstructor = Object;