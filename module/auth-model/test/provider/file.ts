import { InjectableFactory } from '@travetto/di';
import { FileModelConfig, FileModelService } from '@travetto/model';
import { Suite } from '@travetto/test';
import { AuthModelSym } from '../../src/principal';
import { AuthModelServiceSuite } from '../../test-support/service';

class Init {
  @InjectableFactory(AuthModelSym)
  static modelProvider(config: FileModelConfig) {
    return new FileModelService(config);
  }
}

@Suite()
export class FileAuthModelServiceSuite extends AuthModelServiceSuite {
  constructor() {
    super(FileModelService, FileModelConfig);
  }
}