import { InjectableFactory } from '@travetto/di';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model';
import { Suite } from '@travetto/test';

import { AssetModelⲐ } from '../../src/service';
import { AssetServiceSuite } from '../../support/test.service';

class Init {
  @InjectableFactory(AssetModelⲐ)
  static modelProvider(config: MemoryModelConfig) {
    return new MemoryModelService(config);
  }
}

@Suite()
export class MemoryAssetServiceSuite extends AssetServiceSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}