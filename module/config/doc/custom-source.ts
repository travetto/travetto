import { ConfigSource, ConfigValue } from '@travetto/config';
import { Injectable } from '@travetto/di';

@Injectable()
export class CustomConfigSource implements ConfigSource {
  priority = 1000;
  name = 'custom';

  async getValues(): Promise<ConfigValue[]> {
    return [
      {
        config: { user: { name: 'bob' } },
        priority: this.priority,
        profile: 'override',
        source: `custom://${CustomConfigSource.name}`
      }
    ];
  }
}