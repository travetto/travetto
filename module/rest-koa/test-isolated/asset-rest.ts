// @with-module @travetto/asset-rest
// @with-module @vendia/serverless-express

import { AssetRestServerSuite } from '@travetto/asset-rest/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class KoaAssetRestTest extends AssetRestServerSuite { }

@Suite()
export class KoaAssetRestLambdaTest extends AssetRestServerSuite {
  type = 'lambda';
}