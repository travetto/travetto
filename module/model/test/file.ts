import { Suite } from '@travetto/test';

import { FileModelConfig, FileModelService } from '../src/provider/file';
import { ModelCrudSuite } from '../support/test/crud';
import { ModelExpirySuite } from '../support/test/expiry';
import { ModelStreamSuite } from '../support/test/stream';
import { ModelBasicSuite } from '../support/test/basic';

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
export class FileStreamSuite extends ModelStreamSuite {
  serviceClass = FileModelService;
  configClass = FileModelConfig;
}

@Suite()
export class FileExpirySuite extends ModelExpirySuite {
  serviceClass = FileModelService;
  configClass = FileModelConfig;
}