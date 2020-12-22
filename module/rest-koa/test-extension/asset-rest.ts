// @file-if @travetto/asset-rest
// @file-if aws-serverless-express

import { AssetRestServerSuite } from '@travetto/asset-rest//server';
import { Suite } from '@travetto/test';

@Suite()
export class KoaAssetRestTest extends AssetRestServerSuite {
  constructor() {
    super(3004);
  }
}

@Suite()
export class KoaAssetRestLambdaTest extends AssetRestServerSuite {
  constructor() {
    super(true);
  }
}