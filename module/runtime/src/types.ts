import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Any = any;

export type AnyMap = { [key: string]: Any };
export type Class<T = Any> = abstract new (...args: Any[]) => T;
export type ClassInstance<T = Any> = T & { constructor: Class<T> };

export type BinaryInput = Blob | Buffer | Readable | ReadableStream;

export type TypedFunction<R = Any, V = unknown> = (this: V, ...args: Any[]) => R;

export type MethodDescriptor<V = Any, R = Any> = TypedPropertyDescriptor<TypedFunction<R, V>>;
export type AsyncMethodDescriptor<V = Any, R = Any> = TypedPropertyDescriptor<TypedFunction<Promise<R>, V>>;
export type AsyncItrMethodDescriptor<V = Any, R = Any> = TypedPropertyDescriptor<TypedFunction<AsyncIterable<R>, V>>;
export type ClassTDecorator<T extends Class = Class> = (target: T) => T | void;

export type Primitive = number | bigint | boolean | string | Date;

export type DeepPartial<T> = {
  [P in keyof T]?: (T[P] extends (Primitive | undefined) ? (T[P] | undefined) :
    (T[P] extends Any[] ? (DeepPartial<T[P][number]> | null | undefined)[] : DeepPartial<T[P]>));
};

export const TypedObject: {
  keys<T = unknown, K extends keyof T = keyof T & string>(o: T): K[];
  fromEntries<K extends string | symbol, V>(items: ([K, V] | readonly [K, V])[]): Record<K, V>;
  entries<K extends Record<symbol | string, unknown>>(record: K): [keyof K, K[keyof K]][];
} & ObjectConstructor = Object;

export function castTo<T>(input: unknown): T {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return input as T;
}

export const castKey = <T>(input: string | number | symbol): keyof T => castTo(input);
export const asFull = <T>(input: Partial<T>): T => castTo(input);
export const asConstructable = <Z = unknown>(input: Class | unknown): { constructor: Class<Z> } => castTo(input);

export function classConstruct<T>(cls: Class<T>, args: unknown[] = []): ClassInstance<T> {
  const cons: { new(..._args: Any[]): T } = castTo(cls);
  return castTo(new cons(...args));
}

export const hasFunction = <T>(key: keyof T) => (o: unknown): o is T =>
  typeof o === 'object' && o !== null && typeof o[castKey(key)] === 'function';

export const hasToJSON = hasFunction<{ toJSON(): object }>('toJSON');

export function toConcrete<T extends unknown>(): Class<T> {
  return arguments[0];
}

/**
 * Range of bytes, inclusive
 */
export type ByteRange = { start: number, end?: number };

export interface BlobMeta {
  /** Size of blob */
  size?: number;
  /** Mime type of the content */
  contentType?: string;
  /** Hash of blob contents */
  hash?: string;
  /** The original base filename of the file */
  filename?: string;
  /** Filenames title, optional for elements like images, audio, videos */
  title?: string;
  /** Content encoding */
  contentEncoding?: string;
  /** Content language */
  contentLanguage?: string;
  /** Cache control */
  cacheControl?: string;
  /** Byte range for blob */
  range?: Required<ByteRange>;
}
