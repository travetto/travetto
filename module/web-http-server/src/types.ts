import { Any } from '@travetto/runtime';

export type WebSecureKeyPair = { cert: string, key: string };

/**
 * Handle for a web server
 */
export type WebServerHandle<T = Any> = {
  target: T;
  complete: Promise<void>;
  stop: (immediate?: boolean) => Promise<void>;
};

/**
 * Defines the shape of the web server
 *
 * @concrete
 */
export interface WebHttpServer {
  serve(): Promise<WebServerHandle>;
}