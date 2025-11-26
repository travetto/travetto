import { Class, ClassInstance, getClass } from '@travetto/runtime';
import { DependencyRegistryIndex } from '@travetto/di';
import { SchemaRegistryIndex } from '@travetto/schema';

import { ConfigurationService, ConfigBaseType } from './service.ts';
import { ConfigOverrideUtil } from './util.ts';

/**
 * Indicates that the given class should be populated with the configured fields, on instantiation
 * @augments `@travetto/schema:Schema`
 * @decorator
 */
export function Config(ns: string) {
  return <T extends Class>(cls: T): T => {
    // Declare as part of global config
    SchemaRegistryIndex.getForRegister(cls).register({ interfaces: [ConfigBaseType] });

    ConfigOverrideUtil.setOverrideConfig(cls, ns);

    DependencyRegistryIndex.getForRegister(cls).registerClass();

    const og: Function = cls.prototype.postConstruct;
    cls.prototype.postConstruct = async function (): Promise<void> {
      // Apply config
      const cfg = await DependencyRegistryIndex.getInstance(ConfigurationService);
      await cfg.bindTo(cls, this, ns);
      await og?.call(this);
    };
    return cls;
  };
}

/**
 * Allows for binding specific fields to environment variables as a top-level override
 * @decorator
 */
export function EnvVar(name: string, ...others: string[]) {
  return (instance: ClassInstance, property: string): void => {
    ConfigOverrideUtil.setOverrideConfigField(getClass(instance), property, [name, ...others]);
  };
}