import type { RedisClientOptions } from '@redis/client';

import { Config } from '@travetto/config';

@Config('model.redis')
export class RedisModelConfig {
  client: RedisClientOptions = {};
  namespace?: string;
  modifyStorage?: boolean;
  readBeforeUpdate?: boolean = false;
}
