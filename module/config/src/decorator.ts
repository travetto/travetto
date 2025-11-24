import { Class, ClassInstance } from '@travetto/runtime';
import { DependencyRegistryIndex } from '@travetto/di';
import { SchemaRegistryIndex } from '@travetto/schema';

import { OverrideConfig, OverrideConfigSymbol } from './source/override.ts';
import { ConfigurationService, ConfigBaseType } from './service.ts';

/**
 * Indicates that the given class should be populated with the configured fields, on instantiation
 * @augments `@travetto/schema:Schema`
 */
export function Config(ns: string) {
  return <T extends Class>(cls: T): T => {
    // Declare as part of global config
    SchemaRegistryIndex.getForRegister(cls).register({ interfaces: [ConfigBaseType] });
    SchemaRegistryIndex.getForRegister(cls).registerMetadata<OverrideConfig>(OverrideConfigSymbol, { ns, fields: {} });
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
 */
export function EnvVar(name: string, ...others: string[]) {
  return (instance: ClassInstance, property: string): void => {
    const env = SchemaRegistryIndex.getForRegisterByInstance(instance)
      .registerMetadata<OverrideConfig>(OverrideConfigSymbol, { ns: '', fields: {} });
    env.fields[property] = (): string | undefined =>
      process.env[[name, ...others].find(x => !!process.env[x])!];
  };
}