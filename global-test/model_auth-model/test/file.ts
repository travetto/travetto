import { InjectableFactory } from '@travetto/di';
import { FileModelConfig, FileModelService } from '@travetto/model-file';
import { Suite } from '@travetto/test';

import { AuthModelServiceSuite, TestModelSvcⲐ } from '@travetto/auth-model/support/test/model';

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