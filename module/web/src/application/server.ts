import type { EndpointConfig } from '../registry/types.ts';

export type WebServerHandle = { close(): (unknown | Promise<unknown>), on(type: 'close', callback: () => void): unknown | void, port?: number };

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
   * @param key The identifier for the set of endpoints
   * @param path The path to add the endpoints to
   * @param endpoints The list of endpoints to add
   */
  registerEndpoints(key: string | symbol, path: string, endpoints: EndpointConfig[]): Promise<void>;

  /**
   * The endpoints to unregister
   * @param key The key to unregister by
   */
  unregisterEndpoints(key: string | symbol): Promise<void>;

  /**
   * Start the listening process
   */
  listen(): WebServerHandle | Promise<WebServerHandle>;
}