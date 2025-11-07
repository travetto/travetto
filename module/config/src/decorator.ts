import { Class, ClassInstance } from '@travetto/runtime';
import { DependencyRegistryIndex } from '@travetto/di';
import { SchemaRegistryIndex } from '@travetto/schema';
import { RegistryV2 } from '@travetto/registry';

import { OverrideConfig, OverrideConfigSymbol } from './source/override.ts';
import { ConfigurationService, ConfigBaseType } from './service.ts';

/**
 * Indicates that the given class should be populated with the configured fields, on instantiation
 * @augments `@travetto/schema:Schema`
 * @augments `@travetto/di:Injectable`
 */
export function Config(ns: string) {
  return <T extends Class>(target: T): T => {
    const og: Function = target.prototype.postConstruct;
    // Declare as part of global config
    RegistryV2.getForRegister(DependencyRegistryIndex, target).register({ interfaces: [ConfigBaseType] });
    const env = SchemaRegistryIndex.getForRegister(target)
      .registerMetadata<OverrideConfig>(OverrideConfigSymbol, { ns, fields: {} });
    env.ns = ns;

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