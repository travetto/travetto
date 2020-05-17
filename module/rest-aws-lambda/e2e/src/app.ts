import { InjectableFactory } from '@travetto/di';
import { Application } from '@travetto/app';
import { RestServer } from '@travetto/rest';
import { AwsLambdaRestServer } from '../../src/app';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestServer {
    return new AwsLambdaRestServer();
  }

  constructor(private server: RestServer) { }

  run() {
    return this.server.run();
  }
}