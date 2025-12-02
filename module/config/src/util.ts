import { Any, asFull, Class } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

export const OverrideConfigSymbol = Symbol.for('@travetto/config:overrides');

/**
 * Configuration Override
 */
export type OverrideConfig = {
  namespace?: string;
  fields?: Record<string, () => (unknown | undefined)>;
};

/**
 * Utility for managing override configuration via SchemaRegistryIndex
 */
export class ConfigOverrideUtil {
  static getOverrideConfig(cls: Class<Any>): OverrideConfig | undefined {
    return SchemaRegistryIndex.get(cls).getMetadata<OverrideConfig>(OverrideConfigSymbol);
  }

  static getAllOverrideConfigs(): Required<OverrideConfig>[] {
    const out: Required<OverrideConfig>[] = [];
    for (const cls of SchemaRegistryIndex.getClasses()) {
      const config = this.getOverrideConfig(cls);
      if (config && config.fields && config.namespace) {
        out.push(asFull(config));
      }
    }
    return out;
  }

  static setOverrideConfigField(cls: Class<Any>, field: string, names: string[]): void {
    const env = SchemaRegistryIndex.getForRegister(cls)
      .registerMetadata<OverrideConfig>(OverrideConfigSymbol, {});

    (env.fields ??= {})[field] = (): string | undefined =>
      process.env[names.find(x => !!process.env[x])!];
  }

  static setOverrideConfig(cls: Class<Any>, namespace: string): void {
    SchemaRegistryIndex.getForRegister(cls).registerMetadata<OverrideConfig>(OverrideConfigSymbol, { namespace });
  }
}