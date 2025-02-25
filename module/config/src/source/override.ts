import { SchemaRegistry } from '@travetto/schema';

import { ConfigOverrides, CONFIG_OVERRIDES } from '../internal/types.ts';
import { ConfigData } from '../parser/types.ts';
import { ConfigSource, ConfigSpec } from './types.ts';

/**
 * Overridable config source, provides ability to override field level values, currently used by
 * - @EnvVar as a means to allow environment specific overrides
 */
export class OverrideConfigSource implements ConfigSource {
  #build(): ConfigData {
    const out: ConfigData = {};
    for (const cls of SchemaRegistry.getClasses()) {
      const { ns, fields = {} } = SchemaRegistry.getMetadata<ConfigOverrides>(cls, CONFIG_OVERRIDES) ?? {};
      for (const [key, value] of Object.entries(fields)) {
        const val = value();
        if (val !== undefined && val !== '') {
          out[`${ns}.${key}`] = val;
        }
      }
    }
    return out;
  }

  get(): ConfigSpec {
    return { data: this.#build(), priority: 999, source: 'memory://override' };
  }
}