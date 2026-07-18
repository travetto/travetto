import { InjectableFactory } from '@travetto/di';
import { type MongoModelConfig, MongoModelService } from '@travetto/model-mongo';

export class Init {
  @InjectableFactory({
    primary: true
  })
  static getModelSource(config: MongoModelConfig) {
    return new MongoModelService(config);
  }
}
