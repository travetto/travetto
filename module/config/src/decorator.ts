import { Class, ClassInstance } from '@travetto/base';
import { DependencyRegistry } from '@travetto/di';
import { SchemaRegistry } from '@travetto/schema';

import { Configuration } from './configuration';
import { ConfigTarget, ConfigOverrides, CONFIG_OVERRIDES } from './internal/types';

/**
 * Indicates that the given class should be populated with the configured fields, on instantiation
 * @augments `@trv:schema/Schema`
 * @augments `@trv:di/Injectable`
 */
export function Config(ns: string) {
  return <T extends Class>(target: T): T => {
    const og: Function = target.prototype.postConstruct;
    // Declare as part of global config
    (DependencyRegistry.getOrCreatePending(target).interfaces ??= []).push(ConfigTarget);
    const env = SchemaRegistry.getOrCreatePendingMetadata<ConfigOverrides>(target, CONFIG_OVERRIDES, { ns, fields: {} });
    env.ns = ns;

    target.prototype.postConstruct = async function (): Promise<void> {
      // Apply config
      const cfg = await DependencyRegistry.getInstance(Configuration);
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
  return (inst: ClassInstance, prop: string) => {
    const env = SchemaRegistry.getOrCreatePendingMetadata<ConfigOverrides>(inst.constructor, CONFIG_OVERRIDES, { ns: '', fields: {} });
    env.fields[prop] = () => process.env[name];
  }
}