import { Class, AppError, Env, Runtime } from '@travetto/base';
import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { RetargettingProxy, ChangeEvent } from '@travetto/registry';
import { ConfigurationService } from '@travetto/config';

import { RouteConfig, Request, ServerHandle } from '../types';
import { RestConfig } from './config';
import { RouteUtil } from '../util/route';
import { RestInterceptor } from '../interceptor/types';
import { ControllerRegistry } from '../registry/controller';
import { GlobalRoute, RestInterceptorTarget } from '../internal/types';
import { RestServer } from './server';
import { RestCommonUtil } from '../util/common';

/**
 * The rest application
 */
@Injectable()
export class RestApplication<T = unknown> {

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
  info: Record<string, unknown>;

  constructor() {
    this.onControllerChange = this.onControllerChange.bind(this);
    this.globalHandler = this.globalHandler.bind(this);
  }

  async postConstruct(): Promise<void> {
    this.info = {
      module: Runtime.context.main.name,
      version: Runtime.context.main.version,
      env: Env.name
    };

    // Log on startup, before DI finishes
    const cfg = await DependencyRegistry.getInstance(ConfigurationService);
    await cfg.initBanner();

    await this.server.init();

    this.interceptors = await this.getInterceptors();

    // Register all active
    await Promise.all(ControllerRegistry.getClasses()
      .map(c => this.registerController(c)));

    this.registerGlobal();

    // Listen for updates
    ControllerRegistry.on(this.onControllerChange);
  }

  /**
   * Handle the global request
   * @param req The http request
   */
  async globalHandler(req: Request): Promise<string | Record<string, unknown>> {
    if (req.method === 'OPTIONS') {
      return '';
    } else if (req.path === '/' && this.config.defaultMessage) {
      return this.info;
    } else {
      throw new AppError('Resource not found', 'notfound', { path: req.path });
    }
  }

  /**
   * Get the list of installed interceptors
   */
  async getInterceptors(): Promise<RestInterceptor[]> {
    const instances = await DependencyRegistry.getCandidateInstances<RestInterceptor>(RestInterceptorTarget);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const ordered = instances.map(x => ({ key: x.constructor as Class, before: x.before, after: x.after, target: x }));
    const sorted = RestCommonUtil.ordered(ordered).map(x => x.target);

    console.debug('Sorting interceptors', { count: sorted.length, names: sorted.map(x => x.constructor.name) });
    return sorted;
  }

  /**
   * When a controller changes, unregister and re-register the class
   * @param e The change event
   */
  async onControllerChange(e: ChangeEvent<Class>): Promise<void> {
    console.debug('Registry event', { type: e.type, target: (e.curr ?? e.prev)?.Ⲑid });
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
  async registerController(c: Class): Promise<void> {
    if (this.server.listening && !Env.dynamic) {
      console.warn('Reloading only supported in dynamic mode');
      return;
    }

    const config = ControllerRegistry.get(c);
    config.instance = await DependencyRegistry.getInstance(config.class);

    if (Env.dynamic) {
      config.instance = RetargettingProxy.unwrap(config.instance);
    }

    for (const ep of config.endpoints) {
      ep.instance = config.instance;
      ep.handlerFinalized = RouteUtil.createRouteHandler(this.interceptors, ep, config);
    }

    await this.server.registerRoutes(config.class.Ⲑid, config.basePath, config.endpoints, this.interceptors);

    if (this.server.listening && this.server.updateGlobalOnChange) {
      await this.unregisterGlobal();
      await this.registerGlobal();
    }

    console.debug('Registering Controller Instance', { id: config.class.Ⲑid, path: config.basePath, endpointCount: config.endpoints.length });
  }

  /**
   * Unregister a controller
   * @param c The class to unregister
   */
  async unregisterController(c: Class): Promise<void> {
    if (!Env.dynamic) {
      console.warn('Unloading only supported in dynamic mode');
      return;
    }

    await this.server.unregisterRoutes(c.Ⲑid);
  }

  /**
   * Register the global listener as a hardcoded path
   */
  async registerGlobal(): Promise<void> {
    if (this.server.listening && !Env.dynamic) {
      console.warn('Reloading only supported in dynamic mode');
      return;
    }

    const route: RouteConfig = {
      params: [{
        extract: (c: unknown, r: unknown) => r,
        location: 'context'
      }],
      instance: {},
      handler: this.globalHandler,
      method: 'all', path: '*',
    };
    route.handlerFinalized = RouteUtil.createRouteHandler(this.interceptors, route);
    await this.server.registerRoutes(GlobalRoute, '/', [route]);
  }

  /**
   * Remove the global listener
   */
  async unregisterGlobal(): Promise<void> {
    if (!Env.dynamic) {
      console.warn('Unloading only supported in dynamic mode');
      return;
    }

    await this.server.unregisterRoutes(GlobalRoute);
  }

  /**
   * Run the application
   */
  async run(): Promise<ServerHandle> {
    console.info('Listening', { port: this.config.port });
    return await this.server.listen();
  }
}