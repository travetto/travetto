/* eslint-disable @typescript-eslint/no-explicit-any */
export type Promised<R> = (...params: any[]) => Promise<R>;
export type PromisedDescriptor<R> = TypedPropertyDescriptor<Promised<R>>;
export type SimpleType = { [key: string]: SimpleType } | SimpleType[] | undefined | null | string | boolean | RegExp | Date | number;
export type SimpleObject = Record<string, SimpleType>;

export type DeepPartial<T> = {
  [P in keyof T]?: (T[P] extends (number | string | Date | boolean | undefined) ? (T[P] | undefined) :
    (T[P] extends any[] ? (DeepPartial<T[P][number]> | null | undefined)[] : DeepPartial<T[P]>));
};
