import { InjectableFactory } from '@travetto/di';
import { FileModelConfig, FileModelService } from '@travetto/model';
import { Suite } from '@travetto/test';

import { AssetModelⲐ } from '../../src/service';
import { AssetServiceSuite } from '../../support/test/service';

class Init {
  @InjectableFactory(AssetModelⲐ)
  static modelProvider(config: FileModelConfig) {
    return new FileModelService(config);
  }
}

@Suite()
export class FileAssetServiceSuite extends AssetServiceSuite {
  configClass = FileModelConfig;
  serviceClass = FileModelService;
}