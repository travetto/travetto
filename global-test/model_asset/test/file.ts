
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AssetModelⲐ } from '@travetto/asset';
import { AssetServiceSuite } from '@travetto/asset/support/test/service';

import { FileModelConfig, FileModelService } from '@travetto/model';

class Init {
  @InjectableFactory(AssetModelⲐ)
  static modelProvider(config: FileModelConfig) {
    return new FileModelService(config);
  }
}

@Suite()
export class FileAssetServiceSuite extends AssetServiceSuite {
  serviceClass = FileModelService;
  configClass = FileModelConfig;
}
