import { InjectableFactory } from '@travetto/di';
import { FileModelConfig, FileModelService } from '@travetto/model';
import { Suite } from '@travetto/test';

import { AuthModelServiceSuite, TestModelSvcSym } from '../../test-support/service';

class Init {
  @InjectableFactory(TestModelSvcSym)
  static modelProvider(config: FileModelConfig) {
    return new FileModelService(config);
  }
}

@Suite()
export class FileAuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = FileModelService;
  configClass = FileModelConfig;
}