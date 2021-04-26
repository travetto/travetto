// @file-if @travetto/rest-session
// @file-if @vendia/serverless-express

import { InjectableFactory } from '@travetto/di';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model';
import { SessionModelⲐ } from '@travetto/rest-session';
import { RestSessionServerSuite } from '@travetto/rest-session/test-support/server';
import { Suite } from '@travetto/test';

class Config {
  @InjectableFactory({ primary: true, qualifier: SessionModelⲐ })
  static provider() {
    return new MemoryModelService(new MemoryModelConfig());
  }
}

@Suite()
export class ExpressRestSessionTest extends RestSessionServerSuite { }

@Suite()
export class ExpressLambdaRestSessionTest extends RestSessionServerSuite {
  type = 'lambda';
}