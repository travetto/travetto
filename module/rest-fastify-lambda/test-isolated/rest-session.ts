// @with-module @travetto/rest-session
import { InjectableFactory } from '@travetto/di';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model';
import { SessionModelⲐ } from '@travetto/rest-session';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/server';
import { RestSessionServerSuite } from '@travetto/rest-session/support/test.server';
import { Suite } from '@travetto/test';

class Config {
  @InjectableFactory({ primary: true, qualifier: SessionModelⲐ })
  static provider() {
    return new MemoryModelService(new MemoryModelConfig()); w
  }
}

@Suite()
export class FastifyLambdaRestSessionTest extends RestSessionServerSuite {
  type = AwsLambdaRestServerSupport;
}