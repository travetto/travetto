/* eslint-disable @typescript-eslint/no-explicit-any */
export type Class<T = any> = abstract new (...args: any[]) => T;
export type ConcreteClass<T = any> = new (...args: any[]) => T;
export type ClassInstance<T = any> = T & {
  constructor: ConcreteClass<T> & { Ⲑid: string };
};

export type Primitive = number | boolean | string | Date | Error;

export type LogLevel = 'info' | 'warn' | 'debug' | 'error';

export type LineContext = { source: string, line: number, module: string, modulePath: string, scope?: string };

export interface ConsoleListener {
  setDebug?(val: string | boolean): void;
  onLog<T extends LineContext>(context: LogLevel, ctx: T, args: unknown[]): void;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type MethodDescriptor<R = any, V = unknown> = TypedPropertyDescriptor<(this: V, ...params: any[]) => R>;