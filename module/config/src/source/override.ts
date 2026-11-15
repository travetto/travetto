import type { UnknownRecord } from '@travetto/runtime';

import { ConfigOverrideUtil } from '../override.ts';
import type { ConfigPayload, ConfigSource } from './types.ts';

/**
 * Overridable config source, provides ability to override field level values, currently used by
 * - @EnvVar as a means to allow environment specific overrides
 */
export class OverrideConfigSource implements ConfigSource {
  #build(): UnknownRecord {
    const out: UnknownRecord = {};
    for (const { namespace, fields } of ConfigOverrideUtil.getAllOverrideConfigs()) {
      for (const [key, value] of Object.entries(fields)) {
        const data = value();
        if (data !== undefined && data !== '') {
          out[`${namespace}.${key}`] = data;
        }
      }
    }
    return out;
  }

  get(): ConfigPayload {
    return { data: this.#build(), priority: 999, source: 'memory://override' };
  }
}
