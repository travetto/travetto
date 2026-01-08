import type { ConfigSource, ConfigPayload } from '@travetto/config';
import { Injectable } from '@travetto/di';

@Injectable()
class ConfigOverride implements ConfigSource {
  get(): ConfigPayload {
    return {
      data: {
        'web.cookie.keys': ['test']
      },
      priority: 10,
      source: 'direct'
    };
  }
}