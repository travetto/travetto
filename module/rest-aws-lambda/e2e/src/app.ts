import { Application, InjectableFactory } from '@travetto/di';
import { RestApp, RestAppProvider } from '@travetto/rest';
import { AwsLambdaAppProvider } from '../src/app';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestAppProvider {
    return new AwsLambdaAppProvider();
  }

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}