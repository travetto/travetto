import { Cancelable } from '@travetto/runtime';

export type WebSslKeyPair = { cert: string, key: string };

/**
 * Defines the shape of the web server
 *
 * @concrete
 */
export interface WebHttpServer {
  serve(): Promise<Cancelable>;
}