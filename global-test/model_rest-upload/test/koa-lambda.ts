import { Suite } from '@travetto/test';
import { AwsLambdaKoaRestServer } from '@travetto/rest-koa-lambda';
import { InjectableFactory } from '@travetto/di';
import { AwsLambdaRestApplication } from '@travetto/rest-aws-lambda';

import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test/server.ts';

import { ModelBlobRestUploadServerSuite } from './server.ts';

const KOA = Symbol.for('koa-lambda');

class Config {
  @InjectableFactory()
  static getServer(): AwsLambdaKoaRestServer {
    return new AwsLambdaKoaRestServer();
  }

  @InjectableFactory(KOA)
  static getApp(dep: AwsLambdaKoaRestServer): AwsLambdaRestApplication {
    return new AwsLambdaRestApplication(dep);
  }
}

@Suite()
export class KoaLambdaRestUploadTest extends ModelBlobRestUploadServerSuite {
  qualifier = KOA;
  type = AwsLambdaRestServerSupport;
}
