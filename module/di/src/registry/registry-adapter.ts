import { RegistryAdapter } from '@travetto/registry';
import { castKey, castTo, Class, classConstruct } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import { InjectableConfig, getDefaultQualifier, InjectableCandidate } from '../types';

function combineInjectableCandidates(
  cls: Class,
  method: string | symbol,
  base: InjectableCandidate | undefined,
  ...override: Partial<InjectableCandidate>[]
): InjectableCandidate {

  const full: InjectableCandidate = base ?? {
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

  registerConstructor(...data: Partial<InjectableCandidate<unknown>>[]): InjectableCandidate {
    this.register();
    const key = castKey('constructor');
    this.#config.candidates[key] = combineInjectableCandidates(
      this.#cls, key,
      this.#config.candidates[key],
      ...data,
      {
        factory: (...params: unknown[]) => classConstruct(this.#cls, params)
      }
    );
    return this.#config.candidates[key];
  }

  registerFactory(method: string | symbol, ...data: Partial<InjectableCandidate<unknown>>[]): InjectableCandidate {
    this.register();
    this.#config.candidates[method] = combineInjectableCandidates(this.#cls, method, this.#config.candidates[method], ...data);
    return this.#config.candidates[method];
  }

  get(): InjectableConfig<unknown> {
    return this.#config;
  }

  finalize(): void {
    for (const [k, v] of Object.entries(this.#config.candidates)) {
      const schema = SchemaRegistryIndex.get(this.#cls).getMethod(k);
      if (k !== 'constructor') {
        v.candidateType = schema.returnType!.type;
        v.qualifier ??= getDefaultQualifier(v.class);
      }
    }
  }

  getCandidateConfigs(): InjectableCandidate[] {
    return Object.values(this.#config.candidates)
      .filter(item => item.enabled === undefined || item.enabled === true || (typeof item.enabled === 'function' && !item.enabled()));
  }
}
