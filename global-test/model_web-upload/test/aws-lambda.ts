import { Suite } from '@travetto/test';

import { LocalAwsLambdaWebRouter } from '@travetto/web-aws-lambda/support/test/router.ts';

import { ModelBlobWebUploadServerSuite } from './server.ts';

@Suite()
export class AwsLambdaWebUploadTest extends ModelBlobWebUploadServerSuite {
  routerType = LocalAwsLambdaWebRouter;
}
