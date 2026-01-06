import { type Class, type ClassInstance, getClass } from '@travetto/runtime';
import { DependencyRegistryIndex } from '@travetto/di';
import { SchemaRegistryIndex } from '@travetto/schema';

import { ConfigurationService, ConfigBaseType } from './service.ts';
import { ConfigOverrideUtil } from './util.ts';

/**
 * Indicates that the given class should be populated with the configured fields, on instantiation
 * @augments `@travetto/schema:Schema`
 * @kind decorator
 */
export function Config(namespace: string) {
  return <T extends Class>(cls: T): T => {
    // Declare as part of global config
    SchemaRegistryIndex.getForRegister(cls).register({ interfaces: [ConfigBaseType] });

    ConfigOverrideUtil.setOverrideConfig(cls, namespace);

    DependencyRegistryIndex.getForRegister(cls).registerClass();

    const handle: Function = cls.prototype.postConstruct;
    cls.prototype.postConstruct = async function (): Promise<void> {
      // Apply config
      const config = await DependencyRegistryIndex.getInstance(ConfigurationService);
      await config.bindTo(cls, this, namespace);
      await handle?.call(this);
    };
    return cls;
  };
}

/**
 * Allows for binding specific fields to environment variables as a top-level override
 * @kind decorator
 */
export function EnvVar(name: string, ...others: string[]) {
  return (instance: ClassInstance, property: string): void => {
    ConfigOverrideUtil.setOverrideConfigField(getClass(instance), property, [name, ...others]);
  };
}