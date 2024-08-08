/* eslint-disable @typescript-eslint/no-explicit-any */
export type Class<T = any> = abstract new (...args: any[]) => T;
export type ConcreteClass<T = any> = new (...args: any[]) => T;
export type ClassInstance<T = any> = T & {
  constructor: ConcreteClass<T> & { Ⲑid: string };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MethodDescriptor<V = any, R = any> = TypedPropertyDescriptor<(this: V, ...params: any[]) => R>;

export type AnyMap = {
  [key: string]: any;
};

export type Primitive = number | bigint | boolean | string | Date;

export type DeepPartial<T> = {
  [P in keyof T]?: (T[P] extends (Primitive | undefined) ? (T[P] | undefined) :
    (T[P] extends any[] ? (DeepPartial<T[P][number]> | null | undefined)[] : DeepPartial<T[P]>));
};

export const TypedObject: {
  keys<T = unknown, K extends keyof T = keyof T>(o: T): K[];
  fromEntries<K extends string | symbol, V>(items: ([K, V] | readonly [K, V])[]): Record<K, V>;
  entries<K extends Record<symbol | string, unknown>>(record: K): [keyof K, K[keyof K]][];
} & ObjectConstructor = Object;
