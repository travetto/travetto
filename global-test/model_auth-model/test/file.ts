import { InjectableFactory } from '@travetto/di';
import { FileModelConfig, FileModelService } from '@travetto/model-file';
import { Suite } from '@travetto/test';

import { AuthModelServiceSuite, TestModelSvcSymbol } from '@travetto/auth-model/support/test/model.ts';

class Init {
  @InjectableFactory(TestModelSvcSymbol)
  static modelProvider(config: FileModelConfig) {
    return new FileModelService(config);
  }
}

@Suite()
export class FileAuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = FileModelService;
  configClass = FileModelConfig;
}