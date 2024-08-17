import { Suite } from '@travetto/test';
import { ModelBlobSuite } from '@travetto/model-blob/support/test/blob';

import { FileModelConfig, FileModelService } from '@travetto/model';

@Suite()
export class FileBlobServiceSuite extends ModelBlobSuite {
  serviceClass = FileModelService;
  configClass = FileModelConfig;
}
