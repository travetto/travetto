import { Application, InjectableFactory } from '@travetto/di';
import { RestServer, RestApp } from '@travetto/rest';
import { RestAwsLambdaAppProvider } from '../../src/provider';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestApp {
    return new RestAwsLambdaAppProvider();
  }

  constructor(private server: RestServer) { }

  run() {
    this.server.run();
  }
}