import { Suite } from '@travetto/test';
import { AwsLambdaExpressRestServer } from '@travetto/rest-express-lambda';
import { InjectableFactory } from '@travetto/di';
import { AwsLambdaRestApplication } from '@travetto/rest-aws-lambda';

import { AuthRestServerSuite } from '@travetto/auth-rest/support/test/server.ts';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test/server.ts';

const EXPRESS = Symbol.for('express-lambda');

class Config {
  @InjectableFactory()
  static getServer(): AwsLambdaExpressRestServer {
    return new AwsLambdaExpressRestServer();
  }

  @InjectableFactory(EXPRESS)
  static getApp(dep: AwsLambdaExpressRestServer): AwsLambdaRestApplication {
    return new AwsLambdaRestApplication(dep);
  }
}

@Suite()
export class ExpressLambdaAuthRestTest extends AuthRestServerSuite {
  qualifier = EXPRESS;
  type = AwsLambdaRestServerSupport;
}
