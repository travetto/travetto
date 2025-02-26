import type { RestInterceptor } from '../interceptor/types.ts';
import type { RouteConfig, RestServerHandle } from '../types.ts';

/**
 * Defines the contract for any rest server to support the
 * framework.
 *
 * @concrete ../internal/server#RestServerTarget
 */
export interface RestServer<T = unknown> {

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
  registerRoutes(key: string | symbol, path: string, endpoints: RouteConfig[], interceptors?: RestInterceptor[]): Promise<void>;

  /**
   * The routes to unregister
   * @param key The key to unregister by
   */
  unregisterRoutes(key: string | symbol): Promise<void>;

  /**
   * Start the listening process
   */
  listen(): RestServerHandle | Promise<RestServerHandle>;
}