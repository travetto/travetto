import { AuthWebServerSuite } from '@travetto/auth-web/support/test/server';
import { Suite } from '@travetto/test';
import { AwsLambdaExpressWebServer } from '@travetto/web-express-lambda';
import { InjectableFactory } from '@travetto/di';
import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server';
import { AwsLambdaWebApplication } from '@travetto/web-aws-lambda';

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
export class ExpressLambdaAuthWebTest extends AuthWebServerSuite {
  qualifier = EXPRESS;
  type = AwsLambdaWebServerSupport;
}
