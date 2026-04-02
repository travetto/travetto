import { Suite } from '@travetto/test';
import { DynamoDBModelConfig, DynamoDBModelService } from '@travetto/model-dynamodb';

import { ModelIndexedSuite } from '@travetto/model-indexed/support/test/indexed.ts';
import { ModelIndexedPolymorphismSuite } from '@travetto/model-indexed/support/test/polymorphism.ts';

@Suite()
class DynamoDBIndexedSuite extends ModelIndexedSuite {
  serviceClass = DynamoDBModelService;
  configClass = DynamoDBModelConfig;
}

@Suite()
class DynamoDBIndexedPolymorphicSuite extends ModelIndexedPolymorphismSuite {
  serviceClass = DynamoDBModelService;
  configClass = DynamoDBModelConfig;
}
