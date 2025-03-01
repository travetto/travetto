import type { HttpInterceptor } from '../interceptor/types';
import type { RouteConfig, WebServerHandle } from '../types';

/**
 * Defines the contract for any http server to support the framework.
 *
 * @concrete
 */
export interface WebServer<T = unknown> {

  /**
   * Is the server listening
   */
  listening: boolean;

  /**
   * Should global be re-registered on any changes
   */
  updateGlobalOnChange?: boolean;

  /**
   * Initialize the raw application
   */
  init(): Promise<T> | T;

  /**
   * Register new routes
   * @param key The identifier for the set of routes
   * @param path The path to add the routes to
   * @param endpoints The list of endpoints to add
   */
  registerRoutes(key: string | symbol, path: string, endpoints: RouteConfig[], interceptors?: HttpInterceptor[]): Promise<void>;

  /**
   * The routes to unregister
   * @param key The key to unregister by
   */
  unregisterRoutes(key: string | symbol): Promise<void>;

  /**
   * Start the listening process
   */
  listen(): WebServerHandle | Promise<WebServerHandle>;
}