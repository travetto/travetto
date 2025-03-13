import { Class, AppError, Runtime, toConcrete } from '@travetto/runtime';
import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { RetargettingProxy, ChangeEvent } from '@travetto/registry';
import { ConfigurationService } from '@travetto/config';

import { WebServerHandle } from '../types.ts';
import { WebConfig } from './config.ts';
import { EndpointUtil } from '../util/endpoint.ts';
import { HttpInterceptor } from '../interceptor/types.ts';
import { ControllerRegistry } from '../registry/controller.ts';
import { WebSymbols } from '../symbols.ts';
import { WebServer } from './server.ts';
import { WebCommonUtil } from '../util/common.ts';
import { EndpointConfig } from '../registry/types.ts';
import { WebContext } from '../context.ts';

/**
 * The web application
 */
@Injectable()
export class WebApplication<T = unknown> {

  @Inject()
  config: WebConfig;

  @Inject()
  server: WebServer<T>;

  /**
   * List of provided interceptors
   */
  interceptors: HttpInterceptor[] = [];

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
      module: Runtime.main.name,
      version: Runtime.main.version,
      env: Runtime.env
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
   */
  async globalHandler(): Promise<string | Record<string, unknown>> {
    const { request: req } = await DependencyRegistry.getInstance(WebContext);

    if (req.method === 'OPTIONS') {
      return '';
    } else if (req.path === '/' && this.config.defaultMessage) {
      return this.info;
    } else {
      throw new AppError('Resource not found', { category: 'notfound', details: { path: req.path } });
    }
  }

  /**
   * Get the list of installed interceptors
   */
  async getInterceptors(): Promise<HttpInterceptor[]> {
    const instances = await DependencyRegistry.getCandidateInstances(toConcrete<HttpInterceptor>());
    const ordered = instances.map(x => ({ key: x.constructor, before: x.runsBefore, after: x.dependsOn, target: x }));
    const sorted = WebCommonUtil.ordered(ordered).map(x => x.target);

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
    if (this.server.listening && !Runtime.dynamic) {
      console.warn('Reloading only supported in dynamic mode');
      return;
    }

    const config = ControllerRegistry.get(c);
    config.instance = await DependencyRegistry.getInstance(config.class);

    if (Runtime.dynamic) {
      config.instance = RetargettingProxy.unwrap(config.instance);
    }

    for (const ep of EndpointUtil.orderEndpoints(config.endpoints)) {
      ep.instance = config.instance;
      ep.handlerFinalized = EndpointUtil.createEndpointHandler(this.interceptors, ep, config);
    }

    await this.server.registerEndpoints(config.class.Ⲑid, config.basePath, config.endpoints, this.interceptors);

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
    if (!Runtime.dynamic) {
      console.warn('Unloading only supported in dynamic mode');
      return;
    }

    await this.server.unregisterEndpoints(c.Ⲑid);
  }

  /**
   * Register the global listener as a hardcoded path
   */
  async registerGlobal(): Promise<void> {
    if (this.server.listening && !Runtime.dynamic) {
      console.warn('Reloading only supported in dynamic mode');
      return;
    }

    const endpoint: EndpointConfig = {
      id: 'global-all',
      filters: [],
      headers: {},
      class: WebApplication,
      handlerName: this.globalHandler.name,
      params: [],
      instance: {},
      handler: this.globalHandler,
      method: 'all', path: '*',
    };
    endpoint.handlerFinalized = EndpointUtil.createEndpointHandler(this.interceptors, endpoint);
    await this.server.registerEndpoints(WebSymbols.GlobalEndpoint, '/', [endpoint]);
  }

  /**
   * Remove the global listener
   */
  async unregisterGlobal(): Promise<void> {
    if (!Runtime.dynamic) {
      console.warn('Unloading only supported in dynamic mode');
      return;
    }

    await this.server.unregisterEndpoints(WebSymbols.GlobalEndpoint);
  }

  /**
   * Run the application
   */
  async run(): Promise<WebServerHandle> {
    console.info('Listening', { port: this.config.port });
    return await this.server.listen();
  }
}