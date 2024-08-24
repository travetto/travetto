import { RestSessionServerSuite } from '@travetto/rest-session/support/test/server';
import { Suite } from '@travetto/test';
import { AwsLambdaExpressRestServer } from '@travetto/rest-express-lambda';
import { InjectableFactory } from '@travetto/di';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test/server';
import { AwsLambdaRestApplication } from '@travetto/rest-aws-lambda';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';
import { SessionModelⲐ } from '@travetto/rest-session';

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

  @InjectableFactory({ primary: true, qualifier: SessionModelⲐ })
  static provider() {
    return new MemoryModelService(new MemoryModelConfig());
  }
}

@Suite()
export class ExpressLambdaRestSessionTest extends RestSessionServerSuite {
  qualifier = EXPRESS;
  type = AwsLambdaRestServerSupport;
}
