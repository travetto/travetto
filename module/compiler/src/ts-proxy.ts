import type ts from 'typescript';

const state: { module: typeof ts } = { module: undefined! };

export const tsProxyInit = () => import('typescript').then(module => { state.module = module.default; });

export const tsProxy = new Proxy({}, {
  get(_, prop: string) { return state.module[prop as keyof typeof ts]; }
}) as typeof ts;