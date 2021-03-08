// @file-if @travetto/rest-session
// @file-if aws-serverless-express

import { InjectableFactory } from '@travetto/di';
import { StatelessSessionProvider } from '@travetto/rest-session';
import { RestSessionServerSuite } from '@travetto/rest-session/test-support/server';
import { Suite } from '@travetto/test';

class Config {
  @InjectableFactory({ primary: true })
  static provider() {
    return new StatelessSessionProvider();
  }
}

@Suite()
export class KoaRestSessionTest extends RestSessionServerSuite { }

@Suite()
export class KoaLambdaRestSessionTest extends RestSessionServerSuite {
  type = 'lambda';
}