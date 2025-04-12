import { ConfigSource, ConfigSpec } from '@travetto/config';
import { Injectable } from '@travetto/di';

@Injectable()
export class CustomConfigSource implements ConfigSource {
  async get(): Promise<ConfigSpec> {
    return {
      data: { user: { name: 'bob' } },
      source: 'custom://override',
      priority: 2000
    };
  }
}