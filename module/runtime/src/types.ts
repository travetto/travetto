import type { Readable } from 'node:stream';

// biome-ignore lint/suspicious/noExplicitAny: This is the any reference we use explicitly
export type Any = any;

export type AnyMap = { [key: string]: Any };
export type Class<T = Any> = abstract new (...args: Any[]) => T;
export type ClassInstance<T = Any> = T & { constructor: Class<T> };

export type TypedFunction<R = Any, V = unknown> = (this: V, ...args: Any[]) => R;

export type MethodDescriptor<V = Any, R = Any> = TypedPropertyDescriptor<TypedFunction<R, V>>;
export type AsyncMethodDescriptor<V = Any, R = Any> = TypedPropertyDescriptor<TypedFunction<Promise<R>, V>>;
export type AsyncIterableMethodDescriptor<V = Any, R = Any> = TypedPropertyDescriptor<TypedFunction<AsyncIterable<R>, V>>;

export type NumericPrimitive = number | bigint;
export type Primitive = NumericPrimitive | boolean | string;
export type NumericLikeIntrinsic = Date | NumericPrimitive;

export type IntrinsicType = Primitive | Date | ArrayBuffer | Uint8Array | Uint16Array | Uint32Array | Readable | Buffer | Blob | File;
export type UnknownRecord = Record<string, unknown>;

export type DeepPartial<T> =
  | Partial<T>
  | {
      [P in keyof T]?: T[P] extends IntrinsicType | undefined
        ? T[P] | undefined
        : T[P] extends Any[]
          ? (DeepPartial<T[P][number]> | null | undefined)[]
          : DeepPartial<T[P]>;
    };

export type SimpleFields<T, I> = {
  [K in keyof T]: T[K] extends I | undefined ? K : T[K] extends Function | undefined ? never : K;
}[keyof T];

export const TypedObject: {
  keys<T = unknown, K extends keyof T = keyof T & string>(value: T): K[];
  fromEntries<K extends string | symbol, V>(items: ([K, V] | readonly [K, V])[]): Record<K, V>;
  entries<K extends Record<symbol | string, unknown>>(record: K): [keyof K, K[keyof K]][];
  assign<T extends {}, U extends T>(target: T, ...sources: U[]): U;
} & ObjectConstructor = Object;

export const safeAssign = <T extends {}, U extends {}>(target: T, ...sources: U[]): T & U => Object.assign(target, ...sources);

export function castTo<T>(input: unknown): T {
  return input as T;
}

export const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && !!value && !Array.isArray(value);
export const isPlainRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value?.constructor === Object;

export const isClass = (input: unknown): input is Class => typeof input === 'function' && 'Ⲑid' in input;
export const castKey = <T>(input: string | number | symbol): keyof T => castTo(input);
export const asFull = <T>(input: Partial<T>): T => castTo(input);
export const asConstructable = <Z = unknown>(input: Class | unknown): { constructor: Class<Z> } => castTo(input);

export function classConstruct<T>(cls: Class<T>, args: unknown[] = []): ClassInstance<T> {
  const cons: { new (..._args: Any[]): T } = castTo(cls);
  return castTo(new cons(...args));
}

export const hasProperty =
  <T>(key: string | symbol, equalTo?: unknown) =>
  (value: unknown): value is T =>
    typeof value === 'object' && !!value && key in value && (equalTo === undefined || equalTo === value[key as keyof typeof value]);

export const hasFunction =
  <T>(key: keyof T) =>
  (value: unknown): value is T =>
    typeof value === 'object' && !!value && key in value && typeof value[key as keyof typeof value] === 'function';

export const hasToJSON = hasFunction<{ toJSON(): object }>('toJSON');

// biome-ignore lint/complexity/noUselessTypeConstraint: Unknown behaves slightly differently when being used for an inferred type
export function toConcrete<T extends unknown>(): Class<T> {
  // biome-ignore lint/complexity/noArguments: We want to use arguments here
  return arguments[0];
}

/**
 * Find parent class for a given class object
 */
export function getParentClass(cls: Class): Class | undefined {
  const parent: Class = Object.getPrototypeOf(cls);
  return parent.name && parent !== Object ? parent : undefined;
}

export const getConstructor = <T>(value: T): Class<T> => asConstructable<T>(value).constructor;

/**
 * Get the class from an instance or class
 */
export const getClass = <T = unknown>(target: Class | ClassInstance): Class<T> =>
  'Ⲑid' in target ? castTo(target) : asConstructable<T>(target).constructor;

const UNSAFE_PROPERTIES = ['prototype', 'constructor', '__proto__'];
export const isUnsafeProperty = (key: string): key is '__proto__' | 'prototype' | 'constructor' => UNSAFE_PROPERTIES.includes(key);
