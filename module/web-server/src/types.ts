import { RunResponse } from '@travetto/cli';

export type WebSslKeyPair = { cert: string, key: string };

/**
 * Defines the shape of the web server
 *
 * @concrete
 */
export interface WebServer {
  run(): RunResponse | Promise<RunResponse>;
}