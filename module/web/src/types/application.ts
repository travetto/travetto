export type WebApplicationHandle = { close(): (unknown | Promise<unknown>), on(type: 'close', callback: () => void): unknown | void };

/**
 * Defines the shape of the web application
 *
 * @concrete
 */
export interface WebApplication {
  run(): WebApplicationHandle | Promise<WebApplicationHandle>;
}