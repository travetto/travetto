import { hasFunction } from '@travetto/runtime';
import { InjectableConfig } from '../types';

export type DependencyTargetId = string;
export type DependencyClassId = string;
export type Resolved<T> = { config: InjectableConfig<T>, qualifier: symbol, id: string };
export const hasPostConstruct = hasFunction<{ postConstruct: () => Promise<unknown> }>('postConstruct');
export const hasPreDestroy = hasFunction<{ preDestroy: () => Promise<unknown> }>('preDestroy');
export const PrimaryCandidateSymbol = Symbol();
export type ResolutionType = 'strict' | 'loose' | 'any';
