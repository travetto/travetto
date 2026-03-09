/* eslint-disable @typescript-eslint/consistent-type-assertions */
import type ts from 'typescript';

let state: typeof ts | undefined;
let promise: Promise<unknown> | undefined;
export const tsProxyInit = (): Promise<unknown> => promise ??= import('typescript').then(module => { state = module.default; });

export const tsProxy = new Proxy({}!, {
  get(_, prop: string): unknown {
    return state![prop as keyof typeof ts];
  }
}) as typeof ts;