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
  connection?: WebConnection;
  httpQuery?: Record<string, unknown>;
  httpMethod?: HttpMethod;
}

/**
 * Web Request object
 */
export class WebRequest<B = unknown> extends BaseWebMessage<B, WebRequestContext> { }