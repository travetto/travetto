import { InjectableFactory } from '@travetto/di';
import { type FirestoreModelConfig, FirestoreModelService } from '@travetto/model-firestore';

export class Init {
  @InjectableFactory({
    primary: true
  })
  static getModelSource(config: FirestoreModelConfig) {
    return new FirestoreModelService(config);
  }
}
