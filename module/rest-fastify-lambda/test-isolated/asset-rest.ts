// @with-module @travetto/asset-rest
import { AssetRestServerSuite } from '@travetto/asset-rest/support/test.server';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/server';
import { Suite } from '@travetto/test';

@Suite()
export class FastifyAssetRestLambdaTest extends AssetRestServerSuite {
  type = AwsLambdaRestServerSupport;
}