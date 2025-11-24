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
  return <T extends Class>(target: T): T => {
    // Declare as part of global config
    SchemaRegistryIndex.getForRegister(target).register({ interfaces: [ConfigBaseType] });
    SchemaRegistryIndex.getForRegister(target).registerMetadata<OverrideConfig>(OverrideConfigSymbol, { ns, fields: {} });
    DependencyRegistryIndex.getForRegister(target).registerClass();

    const og: Function = target.prototype.postConstruct;
    target.prototype.postConstruct = async function (): Promise<void> {
      // Apply config
      const cfg = await DependencyRegistryIndex.getInstance(ConfigurationService);
      await cfg.bindTo(target, this, ns);
      await og?.call(this);
    };
    return target;
  };
}

/**
 * Allows for binding specific fields to environment variables as a top-level override
 */
export function EnvVar(name: string, ...others: string[]) {
  return (inst: ClassInstance, prop: string): void => {
    const env = SchemaRegistryIndex.getForRegister(inst.constructor)
      .registerMetadata<OverrideConfig>(OverrideConfigSymbol, { ns: '', fields: {} });
    env.fields[prop] = (): string | undefined =>
      process.env[[name, ...others].find(x => !!process.env[x])!];
  };
}