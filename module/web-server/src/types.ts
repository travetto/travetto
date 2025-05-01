export type WebSslKeyPair = { cert: string, key: string };

export type WebServerHandle = { close(): (unknown | Promise<unknown>), on(type: 'close', callback: () => void): unknown | void };

/**
 * Defines the shape of the web server
 *
 * @concrete
 */
export interface WebServer {
  run(): WebServerHandle | Promise<WebServerHandle>;
}