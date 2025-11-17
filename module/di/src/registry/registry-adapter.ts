import { RegistryAdapter, RegistryIndexClass } from '@travetto/registry';
import { castKey, Class } from '@travetto/runtime';

import { InjectableClassConfig, InjectionClassConfig, InjectableFactoryConfig } from '../types';

function combineInjectableClasses(cls: Class, base: InjectableClassConfig | undefined, ...override: Partial<InjectableClassConfig>[]): InjectableClassConfig {
  const full: InjectableClassConfig = base ?? {
    postConstruct: {},
    fields: {},
    constructorParameters: [],
    qualifier: Symbol.for(cls.Ⲑid),
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
    full.constructorParameters = o.constructorParameters ?? full.constructorParameters;
  }
  return full;
}

function combineInjectableFactories(
  cls: Class, method: string | symbol,
  base: InjectableFactoryConfig | undefined,
  ...override: Partial<InjectableFactoryConfig>[]
): InjectableFactoryConfig {

  const full: InjectableFactoryConfig = base ?? {
    class: cls,
    method,
    enabled: true,
    qualifier: Symbol.for(`${cls.Ⲑid}+factory+${method.toString()}`),
    target: cls,
    postConstruct: {},
    parameters: [],
    handle: cls[castKey(method)]
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
    base.injectable.constructorParameters = base.injectable.constructorParameters ?? parent.injectable.constructorParameters;
    base.injectable.postConstruct = {
      ...parent.injectable.postConstruct,
      ...base.injectable.postConstruct
    };
  }
  return base;
}

export class DependencyRegistryAdapter implements RegistryAdapter<InjectionClassConfig> {
  indexCls: RegistryIndexClass<InjectionClassConfig>;

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

    // TODO: Need to backfill target from schema for dependencies
  }
}
