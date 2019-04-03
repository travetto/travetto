import { AppInfo } from '@travetto/base/bootstrap';
import { AppError } from '@travetto/base';
import { DependencyRegistry, Inject } from '@travetto/di';
import { Class, ChangeEvent } from '@travetto/registry';

import { RouteConfig, Request } from './types';
import { RestConfig } from './config';
import { RouteUtil } from './util/route';
import { RestInterceptorGroup } from './interceptor/group';
import { RestInterceptor } from './interceptor/interceptor';
import { ControllerRegistry } from './registry/registry';
import { RestAppCustomizer } from './customizer';

export abstract class RestApp<T = any> {

  static GLOBAL = '___GLOBAL___';

  @Inject()
  interceptorGroup: RestInterceptorGroup;

  @Inject()
  config: RestConfig;

  @Inject()
  customizer?: RestAppCustomizer<T>;

  raw: T;
  interceptors: RestInterceptor[] = [];
  listening = false;

  info = {
    TRAVETTO_VERSION: require('../package.json').version,
    REST_PROVIDER: this.constructor.name,
    ...AppInfo
  };

  constructor() {
    this.onControllerChange = this.onControllerChange.bind(this);
    this.globalHandler = this.globalHandler.bind(this);
  }

  async globalHandler(req: Request) {
    if (req.method === 'OPTIONS') {
      return '';
    } else if (req.path === '/' && this.config.defaultMessage) {
      return this.info;
    } else {
      throw new AppError('Resource not found', 'notfound');
    }
  }

  abstract createRaw(): Promise<T> | T;
  abstract registerRoutes(key: string | symbol, path: string, endpoints: RouteConfig[]): Promise<void>;
  abstract unregisterRoutes(key: string | symbol): Promise<void>;
  abstract listen(): void | Promise<void>;

  async init() {
    await ControllerRegistry.init();

    this.raw = await this.createRaw();

    if (this.customizer) {
      this.raw = (await this.customizer.customize(this.raw)) || this.raw;
    }

    this.interceptors = await this.interceptorGroup.getActive();

    // Register all active
    await Promise.all(ControllerRegistry.getClasses()
      .map(c => this.registerController(c)));

    this.registerGlobal();

    // Listen for updates
    ControllerRegistry.off(this.onControllerChange); // Ensure only one register
    ControllerRegistry.on(this.onControllerChange);
  }

  async onControllerChange(e: ChangeEvent<Class>) {
    console.trace('Registry event', e);
    if (e.prev && ControllerRegistry.hasExpired(e.prev)) {
      await this.unregisterController(e.prev);
    }
    if (e.curr) {
      await this.registerController(e.curr!);
    }
  }

  async registerController(c: Class) {
    const config = ControllerRegistry.get(c);
    config.instance = await DependencyRegistry.getInstance(config.class);

    for (const ep of config.endpoints) {
      ep.instance = config.instance;
      ep.handlerFinalized = RouteUtil.createRouteHandler(this.interceptors, ep, config);
    }

    await this.registerRoutes(config.class.__id, config.basePath, config.endpoints.reverse());
    console.debug('Registering Controller Instance', config.class.__id, config.basePath, config.endpoints.length);
  }

  async unregisterController(c: Class) {
    await this.unregisterRoutes(c.__id);
  }

  async registerGlobal() {
    const route: RouteConfig = { instance: {}, handler: this.globalHandler, method: 'all', path: '*' };
    route.handlerFinalized = RouteUtil.createRouteHandler(this.interceptors, route);
    await this.registerRoutes(RestApp.GLOBAL, '/', [route]);
  }

  async unregisterGlobal() {
    await this.unregisterRoutes(RestApp.GLOBAL);
  }

  async run() {
    await this.init();
    console.info(`Listening on ${this.config.port}`);
    await this.listen();
    this.listening = true;
  }
}