import { InjectableFactory } from '@travetto/di';
import { FileModelConfig, FileModelService } from '@travetto/model-core';
import { Suite } from '@travetto/test';
import { AssetModelSymbol } from '../../src/service';
import { AssetServiceSuite } from '../../test-lib/service';

class Init {
  @InjectableFactory(AssetModelSymbol)
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