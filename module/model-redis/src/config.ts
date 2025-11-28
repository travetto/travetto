import type redis from 'redis';

import { Config } from '@travetto/config';

@Config('model.redis')
export class RedisModelConfig {
  client: redis.RedisClientOptions = {};
  namespace?: string;
  autoCreate?: boolean;

  postConstruct(): void {

  }
}