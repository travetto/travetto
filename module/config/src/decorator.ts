import { Class, ClassInstance } from '@travetto/runtime';
import { DependencyRegistry } from '@travetto/di';
import { SchemaRegistry } from '@travetto/schema';

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
    (DependencyRegistry.getOrCreatePending(target).interfaces ??= []).push(ConfigBaseType);
    const env = SchemaRegistry.getOrCreatePendingMetadata<OverrideConfig>(target, OverrideConfigSymbol, { ns, fields: {} });
    env.ns = ns;

    target.prototype.postConstruct = async function (): Promise<void> {
      // Apply config
      const cfg = await DependencyRegistry.getInstance(ConfigurationService);
      await cfg.bindTo(target, this, ns);
      await og?.call(this);
    };
    return target;
  };
}

/**
 * Allows for binding specific fields to environment variables as a top-level override
 */
export function EnvVar(name: string) {
  return (inst: ClassInstance, prop: string): void => {
    const env = SchemaRegistry.getOrCreatePendingMetadata<OverrideConfig>(inst.constructor, OverrideConfigSymbol, { ns: '', fields: {} });
    env.fields[prop] = (): string | undefined => process.env[name];
  };
}