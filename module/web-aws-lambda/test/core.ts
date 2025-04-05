import { Suite } from '@travetto/test';
import { WebServerSuite } from '@travetto/web/support/test/server.ts';
import { AwsLambdaWebServerSupport } from '../support/test/server-support';

@Suite()
export class AwsLambdaWebCoreTest extends WebServerSuite {
  type = AwsLambdaWebServerSupport;
}