import { RegistryAdapter } from '@travetto/registry';
import { castKey, castTo, Class, classConstruct } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import { InjectableConfig, getDefaultQualifier, InjectableCandidateConfig } from '../types';

function combineInjectableCandidates(
  cls: Class,
  method: string | symbol,
  base: InjectableCandidateConfig | undefined,
  ...override: Partial<InjectableCandidateConfig>[]
): InjectableCandidateConfig {

  const full: InjectableCandidateConfig = base ?? {
    class: cls,
    method,
    enabled: true,
    target: cls,
    factory: (...params: unknown[]) => castTo<Function>(cls[castKey(method)])(...params),
    candidateType: undefined!, // Will be resolved during finalization
  };

  for (const o of override) {
    full.enabled = o.enabled ?? full.enabled;
    full.qualifier = o.qualifier ?? full.qualifier;
    full.target = o.target ?? full.target;
    full.primary = o.primary ?? full.primary;
    full.factory = o.factory ?? full.factory;
  }
  return full;
}

export class DependencyRegistryAdapter implements RegistryAdapter<InjectableConfig> {
  #cls: Class;
  #config: InjectableConfig;

  constructor(cls: Class) {
    this.#cls = cls;
  }

  register(): InjectableConfig {
    return this.#config ??= {
      class: this.#cls,
      candidates: {},
    };
  }

  registerConstructor(...data: Partial<InjectableCandidateConfig<unknown>>[]): InjectableCandidateConfig {
    this.register();
    const key = castKey('constructor');
    return this.#config.candidates[key] ??= combineInjectableCandidates(
      this.#cls, key,
      this.#config.candidates[key],
      ...data,
      {
        factory: (...params: unknown[]) => classConstruct(this.#cls, params)
      }
    );
  }

  registerFactory(method: string | symbol, ...data: Partial<InjectableCandidateConfig<unknown>>[]): InjectableCandidateConfig {
    this.register();
    return combineInjectableCandidates(this.#cls, method, this.#config.candidates[method], ...data);
  }

  get(): InjectableConfig<unknown> {
    return this.#config;
  }

  finalize(): void {
    for (const [k, v] of Object.entries(this.#config.candidates)) {
      const schema = SchemaRegistryIndex.get(this.#cls).getMethod(k);
      v.candidateType = schema.returnType!.type;
      v.qualifier ??= getDefaultQualifier(v.class);
    }
  }

  getInjectables(): InjectableCandidateConfig[] {
    return Object.values(this.#config.candidates);
  }
}
