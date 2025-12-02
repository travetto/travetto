import { IncomingMessage, ServerResponse } from 'node:http';

import { WebFilterContext } from '@travetto/web';

import { ConnectRequest, ConnectResponse } from './connect';


type Middleware = (request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void) => void;

/**
 * Utilities for invoking express middleware with a WebFilterContext
 */
export class WebConnectUtil {
  /**
   * Invoke express middleware, and return the result as a promise.
   *
   * NOTE: If a response is written, then it is thrown as an "error"
   */
  static async invoke<T>(ctx: WebFilterContext,
    handler: (
      request: IncomingMessage,
      response: ServerResponse,
      next: (error: Error | null | undefined, value: T | undefined | null) => void
    ) => Middleware
  ): Promise<T | undefined> {
    const connectReq = ConnectRequest.get(ctx.request);
    const connectRes = ConnectResponse.get();

    const p = Promise.withResolvers<T | undefined>();
    connectRes.on('end', () => p.resolve(null!));

    handler(connectReq, connectRes, (error, value) => error ? p.reject(error) : p.resolve(value!));
    const result = await p.promise;
    connectRes.throwIfSent();
    return result;
  }
}