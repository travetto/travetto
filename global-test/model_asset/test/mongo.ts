import { Suite } from '@travetto/test';

import { MongoModelConfig, MongoModelService } from '@travetto/model-mongo';
import { ModelBlobSuite } from '@travetto/model-blob/support/test/blob';

@Suite()
export class MongoBlobServiceSuite extends ModelBlobSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}
