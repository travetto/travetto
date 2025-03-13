import { Suite } from '@travetto/test';
import { AwsLambdaExpressWebServer } from '@travetto/web-express-lambda';
import { InjectableFactory } from '@travetto/di';
import { AwsLambdaWebApplication } from '@travetto/web-aws-lambda';

import { WebUploadServerSuite } from '@travetto/web-upload/support/test/server.ts';
import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server.ts';

const EXPRESS = Symbol.for('express-lambda');

class Config {
  @InjectableFactory()
  static getServer(): AwsLambdaExpressWebServer {
    return new AwsLambdaExpressWebServer();
  }

  @InjectableFactory(EXPRESS)
  static getApp(dep: AwsLambdaExpressWebServer): AwsLambdaWebApplication {
    return new AwsLambdaWebApplication(dep);
  }
}

@Suite()
export class ExpressLambdaWebUploadTest extends WebUploadServerSuite {
  qualifier = EXPRESS;
  type = AwsLambdaWebServerSupport;
}
