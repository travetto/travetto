import { InjectableFactory } from '@travetto/di';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model';
import { SessionModelⲐ } from '@travetto/rest-session';
import { RestSessionServerSuite } from '@travetto/rest-session/support/test/server';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test/server';
import { Suite } from '@travetto/test';

class Config {
  @InjectableFactory({ primary: true, qualifier: SessionModelⲐ })
  static provider() {
    return new MemoryModelService(new MemoryModelConfig());
  }
}

@Suite()
export class ExpressLambdaRestSessionTest extends RestSessionServerSuite {
  type = AwsLambdaRestServerSupport;
}
