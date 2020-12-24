// @file-if @travetto/asset-rest
// @file-if aws-serverless-express

import { AssetRestServerSuite } from '@travetto/asset-rest/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressAssetRestTest extends AssetRestServerSuite {
  constructor() {
    super(3002);
  }
}

@Suite()
export class ExpressAssetRestLambdaTest extends AssetRestServerSuite {
  constructor() {
    super(true);
  }
}