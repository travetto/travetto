
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AssetModelⲐ } from '@travetto/asset';
import { AssetServiceSuite } from '@travetto/asset/support/test/service';

import { MemoryModelConfig, MemoryModelService } from '@travetto/model';

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
