import { RegistryAdapter } from '@travetto/registry';
import { Class, getAllEntries, safeAssign } from '@travetto/runtime';
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

  registerFactory(method: string | symbol, ...data: Partial<InjectableCandidate<unknown>>[]): InjectableCandidate {
    const { candidates } = this.register();
    candidates[method] ??= {
      class: this.#cls,
      method,
      enabled: true,
      factory: undefined!,
      candidateType: undefined!,
    };
    return combineInjectableCandidates(candidates[method], ...data);
  }

  get(): InjectableConfig<unknown> {
    return this.#config;
  }

  finalize(): void {
    for (const [k] of getAllEntries(this.#config.candidates)) {
      const v = this.#config.candidates[k];
      const candidateType = SchemaRegistryIndex.get(v.class).getMethodReturnType(k);
      v.candidateType = candidateType;
      v.qualifier ??= getDefaultQualifier(candidateType);
    }
  }

  getCandidateConfigs(): InjectableCandidate[] {
    return getAllEntries(this.#config.candidates)
      .map(([_, item]) => item)
      .filter(item => item.enabled !== false && (typeof item.enabled !== 'function' || item.enabled()));
  }
}
