/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
export type Class<T = any> = abstract new (...args: any[]) => T;
export type ClassInstance<T = any> = T & {
  constructor: Class<T> & { Ⲑid: string };
};

export type TypedFunction<R = any, V = unknown> = (this: V, ...args: any[]) => R;

export type MethodDescriptor<V = any, R = any> = TypedPropertyDescriptor<TypedFunction<R, V>>;
export type AsyncMethodDescriptor<V = any, R = any> = TypedPropertyDescriptor<TypedFunction<Promise<R>, V>>;
export type AsyncItrMethodDescriptor<V = any, R = any> = TypedPropertyDescriptor<TypedFunction<AsyncIterable<R>, V>>;
export type ClassTDecorator<T extends Class = Class> = (target: T) => T | void;

export type AnyMap = { [key: string]: any };
export type Any = any;

export type Primitive = number | bigint | boolean | string | Date;

export type DeepPartial<T> = {
  [P in keyof T]?: (T[P] extends (Primitive | undefined) ? (T[P] | undefined) :
    (T[P] extends any[] ? (DeepPartial<T[P][number]> | null | undefined)[] : DeepPartial<T[P]>));
};

export const TypedObject: {
  keys<T = unknown, K extends keyof T = keyof T & string>(o: T): K[];
  fromEntries<K extends string | symbol, V>(items: ([K, V] | readonly [K, V])[]): Record<K, V>;
  entries<K extends Record<symbol | string, unknown>>(record: K): [keyof K, K[keyof K]][];
} & ObjectConstructor = Object;

export function impartialArray<T>(input: Partial<T>[]): T[] {
  return input as unknown as T[];
}

export function impartial<T>(input: Partial<T>): T {
  return input as unknown as T;
}

export function castTo<T>(input: unknown): T {
  return input as T;
}

export function clsInstance<T>(cls: Class<T>, args: unknown[] = []): ClassInstance<T> {
  return castTo(new (cls as { new(..._args: any[]): T })(...args));
}
