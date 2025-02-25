import { Suite } from '@travetto/test';
import { AwsLambdaFastifyRestServer } from '@travetto/rest-fastify-lambda';
import { InjectableFactory } from '@travetto/di';
import { AwsLambdaRestApplication } from '@travetto/rest-aws-lambda';

import { AuthRestServerSuite } from '@travetto/auth-rest/support/test/server';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test/server';

const FASTIFY = Symbol.for('fastify-lambda');

class Config {
  @InjectableFactory()
  static getServer(): AwsLambdaFastifyRestServer {
    return new AwsLambdaFastifyRestServer();
  }

  @InjectableFactory(FASTIFY)
  static getApp(dep: AwsLambdaFastifyRestServer): AwsLambdaRestApplication {
    return new AwsLambdaRestApplication(dep);
  }
}

@Suite()
export class FastifyLambdaAuthRestTest extends AuthRestServerSuite {
  qualifier = FASTIFY;
  type = AwsLambdaRestServerSupport;
}
