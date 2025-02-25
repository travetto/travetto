import { Suite } from '@travetto/test';
import { AwsLambdaExpressRestServer } from '@travetto/rest-express-lambda';
import { InjectableFactory } from '@travetto/di';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test/server.ts';
import { AwsLambdaRestApplication } from '@travetto/rest-aws-lambda';

import { ModelBlobRestUploadServerSuite } from './server.ts';

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
export class ExpressLambdaRestUploadTest extends ModelBlobRestUploadServerSuite {
  qualifier = EXPRESS;
  type = AwsLambdaRestServerSupport;
}
