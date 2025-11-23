import { RegistryAdapter } from '@travetto/registry';
import { castKey, castTo, Class, classConstruct, safeAssign } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import { InjectableConfig, getDefaultQualifier, InjectableCandidate } from '../types';

function combineInjectableCandidates<T extends InjectableCandidate>(base: T, ...override: Partial<T>[]): typeof base {
  for (const o of override) {
    safeAssign(base, o);
  }
  return base;
}

function combineClasses<T extends InjectableConfig>(base: T, ...override: Partial<T>[]): typeof base {
  for (const o of override) {
    Object.assign(base, {
      ...base,
      ...o,
      candidates: {
        ...base.candidates,
        ...o.candidates,
      }
    });
  }
  return base;
}

export class DependencyRegistryAdapter implements RegistryAdapter<InjectableConfig> {
  #cls: Class;
  #config: InjectableConfig;

  constructor(cls: Class) {
    this.#cls = cls;
  }

  register(...data: Partial<InjectableConfig<unknown>>[]): InjectableConfig<unknown> {
    this.#config ??= { class: this.#cls, candidates: {} };
    return combineClasses(this.#config, ...data);
  }

  registerConstructor(...data: Partial<InjectableCandidate<unknown>>[]): InjectableCandidate {
    return this.registerFactory('CONSTRUCTOR', ...data, {
      factory: (...params: unknown[]) => classConstruct(this.#cls, params)
    });
  }

  registerFactory(method: string | symbol, ...data: Partial<InjectableCandidate<unknown>>[]): InjectableCandidate {
    const { candidates } = this.register();
    candidates[method] ??= {
      class: this.#cls,
      method,
      enabled: true,
      factory: (...params: unknown[]) => castTo<Function>(this.#cls[castKey(method)])(...params),
      candidateType: undefined!,
    };
    return combineInjectableCandidates(candidates[method], ...data);
  }

  get(): InjectableConfig<unknown> {
    return this.#config;
  }

  finalize(): void {
    const keys = [
      ...Object.keys(this.#config.candidates),
      ...Object.getOwnPropertySymbols(this.#config.candidates)
    ];
    for (const k of keys) {
      const v = this.#config.candidates[k];

      if (k !== 'CONSTRUCTOR') {
        const candidateType = SchemaRegistryIndex.get(v.class).getMethod(k).returnType?.type!;
        v.candidateType = candidateType;
        v.qualifier ??= getDefaultQualifier(candidateType);
      } else {
        v.candidateType = this.#cls;
      }
    }
  }

  getCandidateConfigs(): InjectableCandidate[] {
    return [
      ...Object.keys(this.#config.candidates),
      ...Object.getOwnPropertySymbols(this.#config.candidates)
    ]
      .map(k => this.#config.candidates[k])
      .filter(item => item.enabled !== false && (typeof item.enabled !== 'function' || item.enabled()));
  }
}
