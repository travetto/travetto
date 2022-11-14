import { Injectable } from '@travetto/di';
import { SchemaRegistry } from '@travetto/schema';

import { ConfigOverrides, CONFIG_OVERRIDES } from '../internal/types';
import { ConfigData } from '../parser/types';
import { ConfigSource, ConfigValue } from './types';

@Injectable()
export class OverrideConfigSource implements ConfigSource {
  priority = 3;
  name = 'override';

  #build(): ConfigData {
    const out: ConfigData = {};
    for (const cls of SchemaRegistry.getClasses()) {
      const { ns, fields = {} } = SchemaRegistry.getMetadata<ConfigOverrides>(cls, CONFIG_OVERRIDES) ?? {};
      for (const [key, value] of Object.entries(fields)) {
        const val = value();
        if (val) {
          out[`${ns}.${key}`] = val;
        }
      }
    }
    return out;
  }

  getValues(profiles: string[]): [ConfigValue] {
    return [{
      config: this.#build(),
      profile: 'override',
      source: 'memory://override',
      priority: this.priority
    }];
  }
}