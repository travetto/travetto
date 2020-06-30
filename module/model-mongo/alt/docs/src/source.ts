import { InjectableFactory } from '@travetto/di';
import { MongoModelConfig } from '../../../src/config';
import { MongoModelSource } from '../../../src/source';

export class Init {
  @InjectableFactory({
    primary: true
  })
  static getModelSource(conf: MongoModelConfig) {
    return new MongoModelSource(conf);
  }
}
