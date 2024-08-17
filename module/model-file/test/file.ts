import { Suite } from '@travetto/test';
import { ModelBlobSuite } from '@travetto/model/support/test/blob';
import { ModelBasicSuite } from '@travetto/model/support/test/basic';
import { ModelCrudSuite } from '@travetto/model/support/test/crud';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry';

import { FileModelConfig, FileModelService } from '../src/file';


@Suite()
export class FileBasicSuite extends ModelBasicSuite {
  serviceClass = FileModelService;
  configClass = FileModelConfig;
}

@Suite()
export class FileCrudSuite extends ModelCrudSuite {
  serviceClass = FileModelService;
  configClass = FileModelConfig;
}

@Suite()
export class FileBlobSuite extends ModelBlobSuite {
  serviceClass = FileModelService;
  configClass = FileModelConfig;
}

@Suite()
export class FileExpirySuite extends ModelExpirySuite {
  serviceClass = FileModelService;
  configClass = FileModelConfig;
}