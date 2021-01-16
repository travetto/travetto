import { Class, AppManifest, AppError } from '@travetto/base';
import { SystemUtil } from '@travetto/base/src/internal/system';
import { DependencyRegistry, Inject } from '@travetto/di';
import { ChangeEvent } from '@travetto/registry';
import { EnvUtil } from '@travetto/boot';

import { RouteConfig, Request, RouteHandler, ParamConfig, ServerHandle } from '../types';
import { RestConfig } from './config';
import { RouteUtil } from '../util/route';
import { RestInterceptor } from '../interceptor/types';
import { ControllerRegistry } from '../registry/controller';
import { GlobalRoute, RestInterceptorTarget } from '../internal/types';

/**
 * The rest server
 */
export abstract class RestServer<T = unknown> {

  @Inject()
  config: RestConfig;

  /**
   * The underlying raw application
   */
  raw: T;
  /**
   * List of provided interceptors
   */
  interceptors: RestInterceptor[] = [];
  /**
   * Is the application listening
   */
  listening = false;

  /**
   * Provide the base information for the app
   */
  info = {
    restProvider: this.constructor.name,
    ...AppManifest.toJSON()
  };

  constructor() {
    this.onControllerChange = this.onControllerChange.bind(this);
    this.globalHandler = this.globalHandler.bind(this);
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
   * Create the raw application
   */
  abstract createRaw(): Promise<T> | T;
  /**
   * Register new routes
   * @param key The identifier for the set of routes
   * @param path The path to add the routes to
   * @param endpoints The list of endpoints to add
   */
  abstract registerRoutes(key: string | symbol, path: string, endpoints: RouteConfig[]): Promise<void>;
  /**
   * The routes to unregister
   * @param key The key to unregister by
   */
  abstract unregisterRoutes(key: string | symbol): Promise<void>;
  /**
   * Start the listening process
   */
  abstract listen(): ServerHandle | Promise<ServerHandle>;

  /**
   * Initialize the application
   */
  async init() {
    await ControllerRegistry.init();

    this.raw = await this.createRaw();

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
    const sorted = SystemUtil.computeOrdering(ordered).map(x => x.target);

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
    if (this.listening && EnvUtil.isReadonly()) {
      console.warn('Reloading not supported in readonly mode');
      return;
    }

    const config = ControllerRegistry.get(c);
    config.instance = await DependencyRegistry.getInstance(config.class);

    for (const ep of config.endpoints) {
      ep.instance = config.instance;
      ep.handlerFinalized = RouteUtil.createRouteHandler(this.interceptors, ep, config);
    }

    await this.registerRoutes(config.class.ᚕid, config.basePath, config.endpoints);
    console.debug('Registering Controller Instance', { id: config.class.ᚕid, path: config.basePath, endpointCount: config.endpoints.length });
  }

  /**
   * Unregister a controller
   * @param c The class to unregister
   */
  async unregisterController(c: Class) {
    if (this.listening && EnvUtil.isReadonly()) {
      console.warn('Unloading not supported in readonly mode');
      return;
    }

    await this.unregisterRoutes(c.ᚕid);
  }

  /**
   * Register the global listener as a hardcoded path
   */
  async registerGlobal() {
    if (this.listening && EnvUtil.isReadonly()) {
      console.warn('Reloading not supported in readonly mode');
      return;
    }

    const route: RouteConfig = {
      params: [{ extract: (c: unknown, r: unknown) => r } as ParamConfig],
      instance: {},
      handler: this.globalHandler as RouteHandler,
      method: 'all', path: '*'
    };
    route.handlerFinalized = RouteUtil.createRouteHandler(this.interceptors, route);
    await this.registerRoutes(GlobalRoute, '/', [route]);
  }

  /**
   * Remove the global listener
   */
  async unregisterGlobal() {
    if (this.listening && EnvUtil.isReadonly()) {
      console.warn('Unloading not supported in readonly mode');
      return;
    }

    await this.unregisterRoutes(GlobalRoute);
  }

  /**
   * Run the application
   */
  async run(): Promise<ServerHandle> {
    await this.init();
    console.info('Listening', { port: this.config.port });
    const listener = await this.listen();
    this.listening = true;
    return listener;
  }
}