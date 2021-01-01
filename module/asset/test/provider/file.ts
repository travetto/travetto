import { InjectableFactory } from '@travetto/di';
import { FileModelConfig, FileModelService } from '@travetto/model-core';
import { Suite } from '@travetto/test';
import { AssetModelSym } from '../../src/service';
import { AssetServiceSuite } from '../../test-support/service';

class Init {
  @InjectableFactory(AssetModelSym)
  static modelProvider(config: FileModelConfig) {
    return new FileModelService(config);
  }
}

@Suite()
export class FileAssetServiceSuite extends AssetServiceSuite {
  constructor() {
    super(FileModelService, FileModelConfig);
  }
}