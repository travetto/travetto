import { AssetRestServerSuite } from '@travetto/asset-rest/support/test/server';
import { Suite } from '@travetto/test';
import { AwsLambdaKoaRestServer } from '@travetto/rest-koa-lambda';
import { InjectableFactory } from '@travetto/di';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test/server';
import { AwsLambdaRestApplication } from '@travetto/rest-aws-lambda';

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
export class KoaLambdaAssetRestTest extends AssetRestServerSuite {
  qualifier = KOA;
  type = AwsLambdaRestServerSupport;
}
