import { WebServerSuite } from '@travetto/web/support/test/server';
import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server';
import { Suite } from '@travetto/test';

@Suite()
export class KoaWebCoreTest extends WebServerSuite {
  type = AwsLambdaWebServerSupport;
}