import { InjectableFactory } from '@travetto/di';
import { type RedisModelConfig, RedisModelService } from '@travetto/model-redis';

export class Init {
  @InjectableFactory({
    primary: true
  })
  static getModelSource(config: RedisModelConfig) {
    return new RedisModelService(config);
  }
}
