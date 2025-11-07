import { RegistryAdapter, RegistryIndexClass } from '@travetto/registry';
import { Class } from '@travetto/runtime';

import { Dependency, InjectableConfig, PostConstructHandler } from '../types';
import { AutoCreate } from './types';

function combineClasses(base: InjectableConfig, ...override: Partial<InjectableConfig>[]): InjectableConfig {
  for (const o of override) {
    base.enabled = o.enabled ?? base.enabled;
    base.qualifier = o.qualifier ?? base.qualifier;
    if (o.interfaces) {
      (base.interfaces ??= []).push(...o.interfaces);
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
    if (o.dependencies) {
      base.dependencies = {
        fields: { ...base.dependencies.fields, ...o.dependencies.fields },
        cons: o.dependencies.cons ?? base.dependencies.cons
      };
    }
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

  /**
   * Register a constructor with dependencies
   */
  registerConstructor(dependencies?: Dependency[]): void {
    const conf = this.register();
    conf.dependencies!.cons = dependencies;
  }

  /**
   * Register a post construct handler
   */
  registerPostConstructHandler(name: string | symbol, handler: PostConstructHandler<unknown>): void {
    const conf = this.register();
    conf.postConstruct[name] = handler;
  }

  /**
   * Register a property as a dependency
   */
  registerProperty(field: string | symbol, dependency: Dependency): void {
    const conf = this.register();
    conf.dependencies.fields[field] = dependency;
  }


  finalize(parent?: InjectableConfig<unknown> | undefined): void {

  }
}
