import { ConfigData } from '../parser/types';
import { ConfigSource, ConfigValue } from './types';

/**
 * Meant to be instantiated and provided as a unique config source
 */
export class MemoryConfigSource implements ConfigSource {
  priority = 1;
  data: Record<string, ConfigData>;
  name = 'memory';

  constructor(data: Record<string, ConfigData>, priority: number = 1) {
    this.data = data;
    this.priority = priority;
  }

  getValues(profiles: string[]): ConfigValue[] {
    const out: ConfigValue[] = [];
    for (const profile of profiles) {
      if (this.data[profile]) {
        out.push({ profile, config: this.data[profile], source: `${this.name}://${profile}`, priority: this.priority });
      }
    }
    return out;
  }
}