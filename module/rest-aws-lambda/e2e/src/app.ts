import { Application, InjectableFactory } from '@travetto/di';
import { RestApp, RestAppProvider } from '@travetto/rest';
import { RestAwsLambdaAppProvider } from '../../src/provider';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestAppProvider {
    return new RestAwsLambdaAppProvider();
  }

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}