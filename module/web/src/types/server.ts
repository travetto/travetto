import { EndpointConfig } from '@travetto/web';
import { HttpMethod } from './core.ts';

export type WebServerHandle = { close(): (unknown | Promise<unknown>), on(type: 'close', callback: () => void): unknown | void, port?: number };
export type WebEndpointCleanup = (() => Promise<void>);

export type WebRouterRequest = { url: string, method: HttpMethod, headers: Record<string, unknown> };
export type WebRouter = (req: WebRouterRequest) => { endpoint: EndpointConfig, params: Record<string, unknown> };

/**
 * Defines the contract for any http server to support the framework.
 *
 * @concrete
 */
export interface WebServer<T = unknown> {

  /**
   * Initialize the raw application
   */
  init(): Promise<T> | T;

  /**
   * Start the listening process
   */
  listen(): WebServerHandle | Promise<WebServerHandle>;

  /**
   * Register the router with server
   */
  registerRouter(router: WebRouter): void;
}