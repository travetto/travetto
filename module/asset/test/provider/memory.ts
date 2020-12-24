import { InjectableFactory } from '@travetto/di';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-core';
import { Suite } from '@travetto/test';
import { AssetModelSymbol } from '../../src/service';
import { AssetServiceSuite } from '../../test-support/service';

class Init {
  @InjectableFactory(AssetModelSymbol)
  static modelProvider(config: MemoryModelConfig) {
    return new MemoryModelService(config);
  }
}


@Suite()
export class MemoryAssetServiceSuite extends AssetServiceSuite {
  constructor() {
    super(MemoryModelService, MemoryModelConfig);
  }
}