import { WebFilter } from '../types.ts';
import { EndpointConfig } from '../registry/types.ts';

export type WebApplicationHandle = { close(): (unknown | Promise<unknown>), on(type: 'close', callback: () => void): unknown | void };
export type WebSslKeyPair = { cert: string, key: string };

/**
 * Defines the shape of the web application
 *
 * @concrete
 */
export interface WebApplication {
  run(): WebApplicationHandle | Promise<WebApplicationHandle>;
}

/**
 * Defines the shape for a web dispatcher
 *
 * @concrete
 */
export interface WebDispatcher {
  /**
   * Dispatch a request, and return a promise when completed
   */
  dispatch: WebFilter;
}

/**
 * Defines the shape for web router internals
 *
 * @concrete
 */
export interface WebRouterSupport extends WebDispatcher {
  /**
   * Register a new endpoint with cleanup
   */
  register(endpoint: EndpointConfig): (() => void) | undefined;
}