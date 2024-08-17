import { Suite } from '@travetto/test';

import { S3ModelConfig, S3ModelService } from '@travetto/model-s3';
import { ModelBlobSuite } from '@travetto/model-blob/support/test/blob';

@Suite()
export class S3BlobServiceSuite extends ModelBlobSuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;
}
