import { Suite } from '@travetto/test';

import { LocalAwsLambdaWebDispatcher } from '@travetto/web-aws-lambda/support/test/dispatcher.ts';

import { ModelBlobWebUploadServerSuite } from './server.ts';

@Suite()
export class AwsLambdaWebUploadTest extends ModelBlobWebUploadServerSuite {
  dispatcherType = LocalAwsLambdaWebDispatcher;
}
