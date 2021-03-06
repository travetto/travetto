// @file-if @travetto/asset-rest
// @file-if aws-lambda-fastify

import { AssetRestServerSuite } from '@travetto/asset-rest/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class FastifyAssetRestTest extends AssetRestServerSuite { }

@Suite()
export class FastifyAssetRestLambdaTest extends AssetRestServerSuite {
  type = 'lambda';
}