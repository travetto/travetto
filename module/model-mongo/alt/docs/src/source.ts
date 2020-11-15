import { InjectableFactory } from '@travetto/di';
import { MongoModelConfig } from '../../../src/config';
import { MongoModelService } from '../../../src/service';

export class Init {
  @InjectableFactory({
    primary: true
  })
  static getModelSource(conf: MongoModelConfig) {
    return new MongoModelService(conf);
  }
}
