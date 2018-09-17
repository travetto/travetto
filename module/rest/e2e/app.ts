import { Application, InjectableFactory, Inject } from '@travetto/di';
import { RestApp, RestAppProvider, ControllerConfig, RestInterceptor } from '../';
import { ContextInterceptor } from '../extension/context';

class DummyAppProvider extends RestAppProvider {
  _raw: any = {};

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
  static getProvider(): RestAppProvider {
    return new DummyAppProvider();
  }

  @Inject()
  contextInterceptor: ContextInterceptor;

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}