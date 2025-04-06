import { Suite } from '@travetto/test';

import { LocalAwsLambdaWebRouter } from '@travetto/web-aws-lambda/support/test/router.ts';
import { BasicWebRouter } from '@travetto/web/support/test/test-router.ts';

import { ModelBlobWebUploadServerSuite } from './server.ts';

@Suite()
export class AwsLambdaWebUploadTest extends ModelBlobWebUploadServerSuite {
  routerType = BasicWebRouter;
  appType = LocalAwsLambdaWebRouter;
}
