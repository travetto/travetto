import { Suite } from '@travetto/test';
import { AwsLambdaWebServer } from '@travetto/web-aws-lambda';
import { InjectableFactory } from '@travetto/di';
import { WebApplication } from '@travetto/web';

import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server-support.ts';

import { ModelBlobWebUploadServerSuite } from './server.ts';

const ServerSymbol = Symbol.for('aws-lambda');

class Config {
  @InjectableFactory(ServerSymbol)
  static getApp(dep: AwsLambdaWebServer): WebApplication {
    return new class extends WebApplication {
      server = dep;
    }();
  }
}

@Suite()
export class AwsLambdaWebUploadTest extends ModelBlobWebUploadServerSuite {
  qualifier = ServerSymbol;
  type = AwsLambdaWebServerSupport;
}
