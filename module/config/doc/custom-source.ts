import type { ConfigSource, ConfigPayload } from '@travetto/config';
import { Injectable } from '@travetto/di';

@Injectable()
export class CustomConfigSource implements ConfigSource {
  async get(): Promise<ConfigPayload> {
    return {
      data: { user: { name: 'bob' } },
      source: 'custom://override',
      priority: 2000
    };
  }
}