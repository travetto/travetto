import { IncomingMessage, ServerResponse } from 'node:http';

import { WebFilterContext } from '@travetto/web';
import { castTo } from '@travetto/runtime';

import { ConnectRequest, ConnectResponse } from './connect';


type Middleware = (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void;

export class WebConnectUtil {
  static async invoke<T>(ctx: WebFilterContext,
    handler: (
      req: IncomingMessage,
      res: ServerResponse,
      next: (err: Error | null | undefined, value: T | undefined | null) => void
    ) => Middleware
  ): Promise<T | undefined> {
    const connectReq = new ConnectRequest(ctx.request);
    const connectRes = new ConnectResponse();

    const p = Promise.withResolvers<T | undefined>();
    handler(castTo(connectReq), castTo(connectRes), (err, value) => err ? p.reject(err) : p.resolve(value!));
    const ret = await p.promise;
    connectRes.throwIfSent();
    return ret;
  }
}