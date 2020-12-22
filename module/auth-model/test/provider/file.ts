import { InjectableFactory } from '@travetto/di';
import { FileModelConfig, FileModelService } from '@travetto/model-core';
import { Suite } from '@travetto/test';
import { AuthModelSymbol } from '../../src/principal';
import { AuthModelServiceSuite } from '../../test-lib/service';

class Init {
  @InjectableFactory(AuthModelSymbol)
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