import * as redis from 'redis';

import { Config } from '@travetto/config';
import { Field } from '@travetto/schema';

@Config('model.redis')
export class RedisModelConfig {

  @Field(Object)
  client: redis.RedisClientOptions = {};
  namespace?: string;
  autoCreate?: boolean;

  postConstruct() {

  }
}