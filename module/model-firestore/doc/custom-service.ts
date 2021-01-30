import { InjectableFactory } from '@travetto/di';
import { FirestoreModelConfig, FirestoreModelService } from '@travetto/model-firestore';

export class Init {
  @InjectableFactory({
    primary: true
  })
  static getModelSource(conf: FirestoreModelConfig) {
    return new FirestoreModelService(conf);
  }
}
