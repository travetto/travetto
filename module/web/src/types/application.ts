import { WebRequest } from './request';
import { WebResponse } from './response';

export type WebServerHandle = { close(): (unknown | Promise<unknown>), on(type: 'close', callback: () => void): unknown | void };
export type WebSslKeyPair = { cert: string, key: string };

/**
 * Defines the shape of the web application
 *
 * @concrete
 */
export interface WebApplication {
  run(): WebServerHandle | Promise<WebServerHandle>;
}

/**
 * Defines the shape for a web router
 *
 * @concrete
 */
export interface WebRouter {
  execute(req: WebRequest): Promise<WebResponse>;
}