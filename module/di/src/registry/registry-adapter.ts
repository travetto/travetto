import { RegistryAdapter } from '@travetto/registry';
import { Class, classConstruct, describeFunction, getAllEntries, safeAssign } from '@travetto/runtime';
import { CONSTRUCTOR_PROPERTY, SchemaRegistryIndex } from '@travetto/schema';

import { InjectableConfig, getDefaultQualifier, InjectableCandidate } from '../types';

function combineInjectableCandidates<T extends InjectableCandidate>(base: T, ...overrides: Partial<T>[]): typeof base {
  for (const override of overrides) {
    safeAssign(base, override);
  }
  return base;
}

function combineClasses<T extends InjectableConfig>(base: T, ...overrides: Partial<T>[]): typeof base {
  for (const override of overrides) {
    Object.assign(base, {
      ...base,
      ...override,
      candidates: {
        ...base.candidates,
        ...override.candidates,
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

  registerClass(...data: Partial<InjectableCandidate<unknown>>[]): InjectableCandidate {
    return this.registerFactory(CONSTRUCTOR_PROPERTY, ...data, {
      factory: (...args: unknown[]) => classConstruct(this.#cls, args),
      candidateType: this.#cls,
    });
  }

  get(): InjectableConfig<unknown> {
    return this.#config;
  }

  finalize(): void {
    for (const [method] of getAllEntries(this.#config.candidates)) {
      const candidate = this.#config.candidates[method];
      const candidateType = SchemaRegistryIndex.get(candidate.class).getMethodReturnType(method);
      candidate.candidateType = candidateType;
      candidate.qualifier ??= getDefaultQualifier(candidateType);
    }
  }

  getCandidateConfigs(): InjectableCandidate[] {
    const entries = getAllEntries(this.#config.candidates).map(([_, item]) => item);
    return entries
      .filter(item => (item.enabled ?? true) === true || (typeof item.enabled === 'function' && item.enabled()))
      .filter(item => item.method !== CONSTRUCTOR_PROPERTY || !describeFunction(item.candidateType)?.abstract);
  }
}
