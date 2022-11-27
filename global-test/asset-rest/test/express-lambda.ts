import { AssetRestServerSuite } from '@travetto/asset-rest/support/test/server';
import { Suite } from '@travetto/test';
import { AwsLambdaExpressRestServer } from '@travetto/rest-express-lambda';
import { InjectableFactory } from '@travetto/di';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test/server';
import { AwsLambdaRestApplication } from '@travetto/rest-aws-lambda';

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
export class ExpressLambdaAssetRestTest extends AssetRestServerSuite {
  qualifier = EXPRESS;
  type = AwsLambdaRestServerSupport;
}
