// @file-if @travetto/asset-rest
// @file-if @vendia/serverless-express

import { AssetRestServerSuite } from '@travetto/asset-rest/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressAssetRestTest extends AssetRestServerSuite {
}

@Suite()
export class ExpressAssetRestLambdaTest extends AssetRestServerSuite {
  type = 'lambda';
}