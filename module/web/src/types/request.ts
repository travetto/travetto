import { HttpMethod, HttpProtocol } from './core.ts';
import { BaseWebMessage } from './message.ts';

export interface WebConnection {
  host?: string;
  port?: number;
  ip?: string;
  httpProtocol?: HttpProtocol;
}

export interface WebRequestContext {
  path: string;
  pathParams?: Record<string, unknown>;
  httpQuery?: Record<string, unknown>;
  httpMethod?: HttpMethod;
  connection?: WebConnection;
}

/**
 * Web Request object
 * @web_contextual
 */
export class WebRequest<B = unknown> extends BaseWebMessage<B, Readonly<WebRequestContext>> {

}