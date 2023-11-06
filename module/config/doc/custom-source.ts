import { ConfigData, ConfigSource } from '@travetto/config';
import { Injectable } from '@travetto/di';

@Injectable()
export class CustomConfigSource implements ConfigSource {
  priority = 2000;
  source = 'custom://override';

  async getData(): Promise<ConfigData> {
    return { user: { name: 'bob' } };
  }
}