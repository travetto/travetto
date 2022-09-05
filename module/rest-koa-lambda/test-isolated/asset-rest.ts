// @with-module @travetto/asset-rest
import { AssetRestServerSuite } from '@travetto/asset-rest/test-support/server';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class KoaAssetRestLambdaTest extends AssetRestServerSuite {
  type = AwsLambdaRestServerSupport;
}