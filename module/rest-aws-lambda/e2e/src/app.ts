import { InjectableFactory } from '@travetto/di';
import { Application } from '@travetto/app';
import { RestApp } from '@travetto/rest';
import { AwsLambdaRestApp } from '../../src/app';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestApp {
    return new AwsLambdaRestApp();
  }

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}