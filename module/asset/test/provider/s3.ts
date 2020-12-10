// @file-if @aws-sdk/client-s3

import { InjectableFactory } from '@travetto/di';
import { S3ModelConfig, S3ModelService } from '@travetto/model-s3';
import { Suite } from '@travetto/test';
import { AssetModelSymbol } from '../../src/service';
import { AssetServiceSuite } from '../service';

class Init {
  @InjectableFactory(AssetModelSymbol)
  static modelProvider(config: S3ModelConfig) {
    return new S3ModelService(config);
  }
}


@Suite()
export class S3AssetServiceSuite extends AssetServiceSuite {
  constructor() {
    super(S3ModelService, S3ModelConfig);
  }
}