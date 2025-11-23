import { RegistryAdapter } from '@travetto/registry';
import { castKey, Class } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import { InjectableClassConfig, InjectionClassConfig, InjectableFactoryConfig, InjectableConfig, getDefaultQualifier } from '../types';

function combineInjectableClasses(cls: Class, base: InjectableClassConfig | undefined, ...override: Partial<InjectableClassConfig>[]): InjectableClassConfig {
  const full: InjectableClassConfig = base ?? {
    type: 'class',
    postConstruct: {},
    fields: {},
    parameters: [],
    qualifier: getDefaultQualifier(cls),
    class: cls,
    enabled: true,
    target: cls,
  };

  for (const o of override) {
    full.enabled = o.enabled ?? full.enabled;
    full.qualifier = o.qualifier ?? full.qualifier;
    full.target = o.target ?? full.target;
    full.postConstruct = { ...full.postConstruct, ...o.postConstruct };
    full.primary = o.primary ?? full.primary;
    full.fields = { ...full.fields, ...o?.fields };
    full.parameters = o.parameters ?? full.parameters;
  }
  return full;
}

function combineInjectableFactories(
  cls: Class, method: string | symbol,
  base: InjectableFactoryConfig | undefined,
  ...override: Partial<InjectableFactoryConfig>[]
): InjectableFactoryConfig {

  const full: InjectableFactoryConfig = base ?? {
    type: 'factory',
    class: cls,
    method,
    enabled: true,
    qualifier: getDefaultQualifier(cls, method),
    target: cls,
    postConstruct: {},
    parameters: [],
    handle: cls[castKey(method)],
    returnType: undefined!, // Will be resolved during finalization
  };

  for (const o of override) {
    full.enabled = o.enabled ?? full.enabled;
    full.qualifier = o.qualifier ?? full.qualifier;
    full.target = o.target ?? full.target;
    full.postConstruct = { ...full.postConstruct, ...o.postConstruct };
    full.primary = o.primary ?? full.primary;
    full.parameters = o.parameters ?? full.parameters;
  }
  return full;
}

function combineClassWithParent(base: InjectionClassConfig, parent: InjectionClassConfig): InjectionClassConfig {
  if (base.injectable && parent.injectable) {
    base.injectable.fields = {
      ...parent.injectable.fields,
      ...base.injectable.fields
    };
    base.injectable.parameters = base.injectable.parameters ?? parent.injectable.parameters;
    base.injectable.postConstruct = {
      ...parent.injectable.postConstruct,
      ...base.injectable.postConstruct
    };
  }
  return base;
}

export class DependencyRegistryAdapter implements RegistryAdapter<InjectionClassConfig> {
  #cls: Class;
  #config: InjectionClassConfig;

  constructor(cls: Class) {
    this.#cls = cls;
  }

  register(): InjectionClassConfig {
    return this.#config ??= {
      class: this.#cls,
      factories: {},
    };
  }

  registerInjectable(...data: Partial<InjectableClassConfig<unknown>>[]): InjectableClassConfig {
    this.register();
    return this.#config.injectable ??= combineInjectableClasses(this.#cls, this.#config.injectable, ...data);
  }

  registerFactory(method: string | symbol, ...data: Partial<InjectableFactoryConfig<unknown>>[]): InjectableFactoryConfig {
    this.register();
    return combineInjectableFactories(this.#cls, method, this.#config.factories[method], ...data);
  }

  get(): InjectionClassConfig<unknown> {
    return this.#config;
  }

  finalize(parentConfig?: InjectionClassConfig<unknown> | undefined): void {
    if (parentConfig) {
      combineClassWithParent(this.#config, parentConfig);
    }
    for (const [k, v] of Object.entries(this.#config.factories)) {
      const schema = SchemaRegistryIndex.get(this.#cls).getMethod(k);
      v.returnType = schema.returnType!.type;
    }
  }

  getInjectables(): InjectableConfig[] {
    const res: InjectableConfig[] = [];
    if (this.#config.injectable) {
      res.push(this.#config.injectable);
    }
    for (const factory of Object.values(this.#config.factories)) {
      res.push(factory);
    }
    return res;
  }
}
