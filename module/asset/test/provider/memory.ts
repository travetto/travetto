import { InjectableFactory } from '@travetto/di';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model';
import { Suite } from '@travetto/test';

import { AssetModelSym } from '../../src/service';
import { AssetServiceSuite } from '../../test-support/service';

class Init {
  @InjectableFactory(AssetModelSym)
  static modelProvider(config: MemoryModelConfig) {
    return new MemoryModelService(config);
  }
}

@Suite()
export class MemoryAssetServiceSuite extends AssetServiceSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}