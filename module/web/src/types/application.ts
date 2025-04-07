import { WebFilter } from '../types.ts';
import { ControllerConfig, EndpointConfig } from '../registry/types.ts';

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
 * Web router pattern
 */
export interface WebRouter extends WebDispatcher {
  /**
   * Register a controller with the prepared endpoints
   */
  register(endpoints: EndpointConfig[], controller: ControllerConfig): Promise<() => void>;
}