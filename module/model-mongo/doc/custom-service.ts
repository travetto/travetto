import { InjectableFactory } from '@travetto/di';
import { MongoModelService, MongoModelConfig } from '@travetto/model-mongo';

export class Init {
  @InjectableFactory({
    primary: true
  })
  static getModelSource(conf: MongoModelConfig) {
    return new MongoModelService(conf);
  }
}
