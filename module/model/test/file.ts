import { Suite } from '@travetto/test';
import { FileModelConfig, FileModelService } from '../src/provider/file';
import { ModelCrudSuite } from '../test-support/crud';
import { ModelExpirySuite } from '../test-support/expiry';
import { ModelStreamSuite } from '../test-support/stream';
import { ModelBasicSuite } from '../test-support/basic';

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