import { ConfigSource, ConfigSpec } from '@travetto/config';
import { Injectable } from '@travetto/di';

@Injectable()
class Cfg implements ConfigSource {
  get(): ConfigSpec {
    return {
      data: {
        'rest.cookie.keys': ['test']
      },
      priority: 10,
      source: 'direct'
    };
  }
}