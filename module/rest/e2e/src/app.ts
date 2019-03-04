import { Application, InjectableFactory, Inject } from '@travetto/di';
import { RestServer, RestApp, ControllerConfig, RestInterceptor } from '../..';
import { ContextInterceptor } from '../../extension/context';

class DummyAppProvider extends RestApp {
  raw: any = {};

  async init() {
    console.log('Initializing');
  }

  listen() {
    console.log('Listening');
  }

  async registerController(config: ControllerConfig) {
    console.log('Registering Controller', config);
  }

  registerInterceptor(inter: RestInterceptor) {
    console.log('Registering Interceptor', inter);
  }

  async unregisterController(config: ControllerConfig) {
    console.log('Un-registering Controller', config);
  }
}

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestApp {
    return new DummyAppProvider();
  }

  @Inject()
  contextInterceptor: ContextInterceptor;

  constructor(private app: RestServer) { }

  run() {
    this.app.run();
  }
}