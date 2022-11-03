import { InjectableFactory } from '@travetto/di';
import { RedisModelConfig, RedisModelService } from '@travetto/model-redis';

export class Init {
  @InjectableFactory({
    primary: true
  })
  static getModelSource(conf: RedisModelConfig) {
    return new RedisModelService(conf);
  }
}
