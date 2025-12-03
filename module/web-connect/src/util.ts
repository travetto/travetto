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
    const connectRequest = ConnectRequest.get(ctx.request);
    const connectResponse = ConnectResponse.get();

    const promise = Promise.withResolvers<T | undefined>();
    connectResponse.on('end', () => promise.resolve(null!));

    handler(connectRequest, connectResponse, (error, value) => error ? promise.reject(error) : promise.resolve(value!));
    const result = await promise.promise;
    connectResponse.throwIfSent();
    return result;
  }
}