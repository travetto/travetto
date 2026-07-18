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

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends IntrinsicType | undefined
    ? T[P] | undefined
    : T[P] extends Any[]
      ? (DeepPartial<T[P][number]> | null | undefined)[]
      : DeepPartial<T[P]>;
};

export type ValidFields<T, I> = {
  [K in keyof T]: T[K] extends Primitive | I | undefined ? K : T[K] extends Function | undefined ? never : K;
}[keyof T];

export type RetainIntrinsicFields<T> = Pick<T, ValidFields<T, IntrinsicType>>;

export type KeyPaths<T, PrimitiveType = IntrinsicType | IntrinsicType[], PREFIX extends string = '', SEP extends string = '.'> = {
  [K in keyof T]: K extends string
    ? T[K] extends IntrinsicType[] | IntrinsicType | undefined
      ? T[K] extends PrimitiveType
        ? `${PREFIX}${K}`
        : never
      : T[K] extends Any[]
        ? KeyPaths<T[K][number], PrimitiveType, `${K}${SEP}`, SEP>
        : T[K] extends object
          ? KeyPaths<T[K], PrimitiveType, `${K}${SEP}`, SEP>
          : never
    : never;
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

export const isClass = (input: unknown): input is Class => typeof input === 'function' && 'Ⲑid' in input;
export const castKey = <T>(input: string | number | symbol): keyof T => castTo(input);
export const asFull = <T>(input: Partial<T>): T => castTo(input);
export const asConstructable = <Z = unknown>(input: Class | unknown): { constructor: Class<Z> } => castTo(input);

export function classConstruct<T>(cls: Class<T>, args: unknown[] = []): ClassInstance<T> {
  const cons: { new (..._args: Any[]): T } = castTo(cls);
  return castTo(new cons(...args));
}

export const hasFunction =
  <T>(key: keyof T) =>
  (value: unknown): value is T =>
    typeof value === 'object' && value !== null && typeof value[castKey(key)] === 'function';

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

/**
 * Get the class from an instance or class
 */
export const getClass = <T = unknown>(value: ClassInstance | Class): Class<T> =>
  'Ⲑid' in value ? castTo(value) : asConstructable<T>(value).constructor;
