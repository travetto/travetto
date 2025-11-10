import { RegistryAdapter, RegistryIndexClass } from '@travetto/registry';
import { Class } from '@travetto/runtime';

import { InjectableConfig } from '../types';

function combineClasses(base: InjectableConfig, ...override: Partial<InjectableConfig>[]): InjectableConfig {
  for (const o of override) {
    base.enabled = o.enabled ?? base.enabled;
    base.qualifier = o.qualifier ?? base.qualifier;
    base.target = o.target ?? base.target;
    base.factory = o.factory ?? base.factory;
    base.postConstruct = { ...base.postConstruct, ...o.postConstruct };
    base.primary = o.primary ?? base.primary;
    base.dependencies = {
      fields: { ...base.dependencies.fields, ...o.dependencies?.fields },
      cons: o.dependencies?.cons ?? base.dependencies.cons
    };
  }
  return base;
}

function combineClassWithParent(base: InjectableConfig, parent: InjectableConfig): InjectableConfig {
  base.dependencies = {
    cons: base.dependencies.cons ?? parent.dependencies.cons,
    fields: {
      ...parent.dependencies.fields,
      ...base.dependencies.fields
    }
  };

  base.postConstruct = {
    ...parent.postConstruct,
    ...base.postConstruct
  };
  return base;
}

export class DependencyRegistryAdapter implements RegistryAdapter<InjectableConfig> {
  indexCls: RegistryIndexClass<InjectableConfig>;

  #cls: Class;
  #config: InjectableConfig;

  constructor(cls: Class) {
    this.#cls = cls;
  }

  register(...data: Partial<InjectableConfig<unknown>>[]): InjectableConfig {
    this.#config ??= {
      qualifier: Symbol.for(this.#cls.Ⲑid),
      class: this.#cls,
      enabled: true,
      target: this.#cls,
      dependencies: {
        fields: {},
        cons: []
      },
      postConstruct: {}
    };
    return combineClasses(this.#config, ...data);
  }

  get(): InjectableConfig<unknown> {
    return this.#config;
  }

  enabled(): boolean {
    return this.#config.enabled === undefined ||
      (typeof this.#config.enabled === 'boolean' ? this.#config.enabled : this.#config.enabled());
  }

  finalize(parentConfig?: InjectableConfig<unknown> | undefined): void {
    if (parentConfig) {
      combineClassWithParent(this.#config, parentConfig);
    }

    // TODO: Need to backfill target from schema for dependencies
  }
}
