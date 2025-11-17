import { hasFunction } from '@travetto/runtime';
import { InjectableCommonConfig } from '../types';

export type DependencyTargetId = string;
export type DependencyClassId = string;
export const hasPostConstruct = hasFunction<{ postConstruct: () => Promise<unknown> }>('postConstruct');
export const hasPreDestroy = hasFunction<{ preDestroy: () => Promise<unknown> }>('preDestroy');
export const PrimaryCandidateSymbol = Symbol();
export class AutoCreate { }

export type Resolved<T> = { config: InjectableCommonConfig<T>, qualifier: symbol, id: string };
