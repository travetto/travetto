import type { ControllerConfig, EndpointConfig } from '../registry/types.ts';

export type WebServerHandle = { close(): (unknown | Promise<unknown>), on(type: 'close', callback: () => void): unknown | void, port?: number };

export type WebEndpointCleanup = (() => Promise<void>);

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
   * Initialize the raw application
   */
  init(): Promise<T> | T;

  /**
   * Register new endpoints
   * @param endpoints The list of endpoints to add
   */
  registerEndpoints(endpoints: EndpointConfig[], controller: ControllerConfig): Promise<void | undefined | WebEndpointCleanup>;

  /**
   * Start the listening process
   */
  listen(): WebServerHandle | Promise<WebServerHandle>;
}