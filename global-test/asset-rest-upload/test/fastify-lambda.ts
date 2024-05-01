import { Suite } from '@travetto/test';
import { AwsLambdaFastifyRestServer } from '@travetto/rest-fastify-lambda';
import { InjectableFactory } from '@travetto/di';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test/server';
import { AwsLambdaRestApplication } from '@travetto/rest-aws-lambda';
import { AssetRestUploadServerSuite } from './server';

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
export class FastifyLambdaRestUploadTest extends AssetRestUploadServerSuite {
  qualifier = FASTIFY;
  type = AwsLambdaRestServerSupport;
}
