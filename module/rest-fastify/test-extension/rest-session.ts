// @file-if @travetto/rest-session
// @file-if aws-lambda-fastify

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
export class FastifyRestSessionTest extends RestSessionServerSuite { }

@Suite()
export class FastifyLambdaRestSessionTest extends RestSessionServerSuite {
  type = 'lambda';
}