import { type Class, type ClassInstance, getClass } from '@travetto/runtime';
import { DependencyRegistryIndex } from '@travetto/di';
import { SchemaRegistryIndex } from '@travetto/schema';

import { ConfigurationService, ConfigBaseType } from './service.ts';
import { ConfigOverrideUtil } from './override.ts';

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

    DependencyRegistryIndex.registerClass(cls);
    DependencyRegistryIndex.registerPostConstruct(cls, {
      priority: 0,
      async operation(this: ClassInstance): Promise<void> {
        const config = await DependencyRegistryIndex.getInstance(ConfigurationService);
        await config.bindTo(cls, this, namespace);
      }
    });
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