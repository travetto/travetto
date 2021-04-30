import { Class, AppManifest, AppError } from '@travetto/base';
import { OrderingUtil } from '@travetto/base/src/internal/ordering';
import { DependencyRegistry, Inject } from '@travetto/di';
import { ChangeEvent } from '@travetto/registry';
import { EnvUtil } from '@travetto/boot';
import { Application } from '@travetto/app';

import { RouteConfig, Request, RouteHandler, ParamConfig, ServerHandle } from '../types';
import { RestConfig } from './config';
import { RouteUtil } from '../util/route';
import { RestInterceptor } from '../interceptor/types';
import { ControllerRegistry } from '../registry/controller';
import { GlobalRoute, RestInterceptorTarget } from '../internal/types';
import { RestServer } from './server';

/**
 * The rest application
 */
@Application('rest', {
  description: 'Default rest application entrypoint'
})
export class RestApplication<T extends unknown = unknown>  {

  @Inject()
  config: RestConfig;

  @Inject()
  server: RestServer<T>;

  /**
   * List of provided interceptors
   */
  interceptors: RestInterceptor[] = [];

  /**
   * Provide the base information for the app
   */
  info = AppManifest.toJSON();

  constructor() {
    this.onControllerChange = this.onControllerChange.bind(this);
    this.globalHandler = this.globalHandler.bind(this);
  }

  postConstruct() {
    this.info.restProvider = this.server.constructor.name;
  }

  /**
   * Handle the global request
   * @param req The http request
   */
  async globalHandler(req: Request) {
    if (req.method === 'OPTIONS') {
      return '';
    } else if (req.path === '/' && this.config.defaultMessage) {
      return this.info;
    } else {
      throw new AppError('Resource not found', 'notfound');
    }
  }

  /**
   * Initialize the application
   */
  async init() {
    await ControllerRegistry.init();

    await this.server.init();

    this.interceptors = await this.getInterceptors();

    // Register all active
    await Promise.all(ControllerRegistry.getClasses()
      .map(c => this.registerController(c)));

    this.registerGlobal();

    // Listen for updates
    ControllerRegistry.off(this.onControllerChange); // Ensure only one register
    ControllerRegistry.on(this.onControllerChange);
  }

  /**
   * Get the list of installed interceptors
   */
  async getInterceptors() {
    const interceptors = DependencyRegistry.getCandidateTypes(RestInterceptorTarget);
    const instances: RestInterceptor[] = [];
    for (const op of interceptors) {
      instances.push(await DependencyRegistry.getInstance<RestInterceptor>(op.target, op.qualifier));
    }

    const ordered = instances.map(x => ({ key: x.constructor, before: x.before, after: x.after, target: x }));
    const sorted = OrderingUtil.compute(ordered).map(x => x.target);

    console.debug('Sorting interceptors', { count: sorted.length, names: sorted.map(x => x.constructor.name) });
    return sorted;
  }

  /**
   * When a controller changes, unregister and re-register the class
   * @param e The change event
   */
  async onControllerChange(e: ChangeEvent<Class>) {
    console.debug('Registry event', { type: e.type, target: (e.curr ?? e.prev)?.ᚕid });
    if (e.prev && ControllerRegistry.hasExpired(e.prev)) {
      await this.unregisterController(e.prev);
    }
    if (e.curr) {
      await this.registerController(e.curr!);
    }
  }

  /**
   * Register a controller
   * @param c The class to register
   */
  async registerController(c: Class) {
    if (this.server.listening && !EnvUtil.isDynamic()) {
      console.warn('Reloading only supported in dynamic mode');
      return;
    }

    const config = ControllerRegistry.get(c);
    config.instance = await DependencyRegistry.getInstance(config.class);

    for (const ep of config.endpoints) {
      ep.instance = config.instance;
      ep.handlerFinalized = RouteUtil.createRouteHandler(this.interceptors, ep, config);
    }

    await this.server.registerRoutes(config.class.ᚕid, config.basePath, config.endpoints, this.interceptors);

    if (this.server.listening && this.server.reregisterGlobalOnChange) {
      await this.unregisterGlobal();
      await this.registerGlobal();
    }

    console.debug('Registering Controller Instance', { id: config.class.ᚕid, path: config.basePath, endpointCount: config.endpoints.length });
  }

  /**
   * Unregister a controller
   * @param c The class to unregister
   */
  async unregisterController(c: Class) {
    if (this.server.listening && !EnvUtil.isDynamic()) {
      console.warn('Unloading only supported in dynamic mode');
      return;
    }

    await this.server.unregisterRoutes(c.ᚕid);
  }

  /**
   * Register the global listener as a hardcoded path
   */
  async registerGlobal() {
    if (!EnvUtil.isDynamic()) {
      console.warn('Reloading only supported in dynamic mode');
      return;
    }

    const route: RouteConfig = {
      params: [{ extract: (c: unknown, r: unknown) => r } as ParamConfig],
      instance: {},
      handler: this.globalHandler as RouteHandler,
      method: 'all', path: '*'
    };
    route.handlerFinalized = RouteUtil.createRouteHandler(this.interceptors, route);
    await this.server.registerRoutes(GlobalRoute, '/', [route]);
  }

  /**
   * Remove the global listener
   */
  async unregisterGlobal() {
    if (!EnvUtil.isDynamic()) {
      console.warn('Unloading only supported in dynamic mode');
      return;
    }

    await this.server.unregisterRoutes(GlobalRoute);
  }

  /**
   * Run the application
   */
  async run(): Promise<ServerHandle> {
    await this.init();
    console.info('Listening', { port: this.config.port });
    return await this.server.listen();
  }
}