import { InjectableFactory } from '@travetto/di';

import { DynamoDBModelService, DynamoDBModelConfig } from '@travetto/model-dynamodb';

export class Init {
  @InjectableFactory({ primary: true })
  static getModelService(conf: DynamoDBModelConfig) {
    return new DynamoDBModelService(conf);
  }
}
