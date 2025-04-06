import { WebFilter } from '../types';

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
 * Defines the shape for a web router
 *
 * @concrete
 */
export interface WebRouter {
  execute: WebFilter;
}