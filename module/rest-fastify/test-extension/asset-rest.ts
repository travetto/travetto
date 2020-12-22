// @file-if @travetto/asset-rest
// @file-if aws-lambda-fastify

import { AssetRestServerSuite } from '@travetto/asset-rest//server';
import { Suite } from '@travetto/test';

@Suite()
export class FastifyAssetRestTest extends AssetRestServerSuite {
  constructor() {
    super(3002);
  }
}

@Suite()
export class FastifyAssetRestLambdaTest extends AssetRestServerSuite {
  constructor() {
    super(true);
  }
}