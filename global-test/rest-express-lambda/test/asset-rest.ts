import { AssetRestServerSuite } from '@travetto/asset-rest/support/test.server';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test.server';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressAssetRestLambdaTest extends AssetRestServerSuite {
  type = AwsLambdaRestServerSupport;
}
