import { Suite } from '@travetto/test';

import { MemoryModelConfig, MemoryModelService } from '@travetto/model';
import { ModelBlobSuite } from '@travetto/model-blob/support/test/blob';

@Suite()
export class MemoryBlobServiceSuite extends ModelBlobSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}
