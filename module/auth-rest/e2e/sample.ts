import { Application, InjectableFactory } from '@travetto/di';
import { RestInterceptorSet, RestInterceptor, RestApp } from '@travetto/rest';
import { Class } from '@travetto/registry';

import { AuthInterceptor } from '../src';
import { AuthPassportInterceptor } from '../extension/passport';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getStack(
    // comp: CompressionOperator,
    // body: BodyOperator,
    // session: SessionOperator,
    auth: AuthInterceptor,
    pass: AuthPassportInterceptor
  ): RestInterceptorSet {
    return new RestInterceptorSet(
      ...[auth, pass].map(x => x.constructor as Class<RestInterceptor>)
    );
  }

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}