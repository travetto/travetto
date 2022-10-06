/* eslint-disable @typescript-eslint/no-explicit-any */
export type MethodDescriptor<R = any, V = unknown> = TypedPropertyDescriptor<(this: V, ...params: any[]) => R>;