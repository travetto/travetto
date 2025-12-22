import type redis from '@redis/client';

import { Config } from '@travetto/config';

@Config('model.redis')
export class RedisModelConfig {
  client: redis.RedisClientOptions = {};
  namespace?: string;
  modifyStorage?: boolean;
}