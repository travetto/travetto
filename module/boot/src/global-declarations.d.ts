/**
 * Extensions to the Function interface, to provide common
 * information for all registered classes
 */
declare interface Function {
  Ⲑid: string;
  Ⲑsource: string;
  Ⲑmeta?: {
    id: string;
    hash: number;
    methods: Record<string, { hash: number }>;
    synthetic: boolean;
    abstract: boolean;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
declare type MethodDescriptor<R = any, V = unknown> = TypedPropertyDescriptor<(this: V, ...params: any[]) => R>;