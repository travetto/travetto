import { RegistryAdapter, RegistryIndexClass } from '@travetto/registry';
import { Class } from '@travetto/runtime';

import { InjectableConfig } from '../types';
import { AutoCreate } from './types';

function combineClasses(base: InjectableConfig, ...override: Partial<InjectableConfig>[]): InjectableConfig {
  for (const o of override) {
    base.enabled = o.enabled ?? base.enabled;
    base.qualifier = o.qualifier ?? base.qualifier;
    if (o.interfaces) {
      (base.interfaces ??= []).push(...o.interfaces);
    }
    if (o.postConstruct) {
      base.postConstruct = { ...base.postConstruct, ...o.postConstruct };
    }
    if (o.primary !== undefined) {
      base.primary = o.primary;
    }
    if (o.target) {
      base.target = o.target;
    }
    if (o.factory) {
      base.factory = o.factory;
    }
    base.dependencies = {
      fields: { ...base.dependencies.fields, ...o.dependencies?.fields },
      cons: o.dependencies?.cons ?? base.dependencies.cons
    };

    if (o.autoCreate) {
      (base.interfaces ??= []).push(AutoCreate);
    }
  }
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
      interfaces: [],
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

  finalize(parentConfig?: InjectableConfig<unknown> | undefined): void {

    if (this.#config.enabled !== undefined && !(typeof this.#config.enabled === 'boolean' ? this.#config.enabled : this.#config.enabled())) {
      return;
    }

    if (parentConfig) {
      this.#config.dependencies = {
        cons: this.#config.dependencies.cons ?? parentConfig.dependencies.cons,
        fields: {
          ...parentConfig.dependencies.fields,
          ...this.#config.dependencies.fields
        }
      };

      // collect interfaces
      this.#config.interfaces = [
        ...parentConfig.interfaces,
        ...this.#config.interfaces
      ];

      this.#config.postConstruct = {
        ...parentConfig.postConstruct,
        ...this.#config.postConstruct
      };
    }
  }
}
