import { IncomingMessage, ServerResponse } from 'node:http';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

import { HttpRequest } from '@travetto/web';
import { castTo, hasFunction } from '@travetto/runtime';

const isReadable = hasFunction<Readable>('pipe');

/**
 * Provide a mapping between node request/response and the framework analogs
 */
export class NodeWebServerUtil {
  /**
   * Build a Travetto HttpRequest from an Express Request
   */
  static getRequest(
    req: IncomingMessage & { originalUrl?: string, secure?: boolean },
    res: ServerResponse,
    params?: Record<string, string>
  ): HttpRequest {

    const url = new URL(`http${req.secure ? 's' : ''}://${req.headers.host}${req.url}`);

    return new HttpRequest({
      protocol: req.secure ? 'https' : 'http',
      method: castTo(req.method),
      path: url.pathname!,
      query: Object.fromEntries(url.searchParams.entries()),
      params,
      headers: req.headers,
      inputStream: req,
      remoteIp: req.socket.remoteAddress,
      port: req.socket.localPort,
      async respond(value): Promise<void> {
        res.statusCode = value.statusCode ?? 200;
        value.headers.forEach((v, k) => res.setHeader(k, v));
        if (isReadable(value.output)) {
          await pipeline(value.output, res);
        } else {
          res.write(value.output);
          res.end();
        }
      }
    });
  }
}