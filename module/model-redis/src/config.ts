import * as redis from 'redis';
import { Config } from '@travetto/config';

@Config('model.redis')
export class RedisModelConfig {

  client: redis.ClientOpts = {};

  postConstruct() {
    this.client = {};
  }
}