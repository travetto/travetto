// @file-if @travetto/model
// @file-if @travetto/di
import { InjectableFactory } from '@travetto/di';
import { FileModelConfig, FileModelService } from '@travetto/model';
import { Suite } from '@travetto/test';

import { AuthModelServiceSuite, TestModelSvcⲐ } from '../test-support/model';

class Init {
  @InjectableFactory(TestModelSvcⲐ)
  static modelProvider(config: FileModelConfig) {
    return new FileModelService(config);
  }
}

@Suite()
export class FileAuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = FileModelService;
  configClass = FileModelConfig;
}