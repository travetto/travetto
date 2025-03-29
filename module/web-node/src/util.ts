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
    req: IncomingMessage & { originalUrl?: string, secure?: boolean, params?: Record<string, string> },
    res: ServerResponse
  ): HttpRequest {

    const url = new URL(`http${req.secure ? 's' : ''}://${req.headers.host}${req.originalUrl}`);

    return new HttpRequest({
      protocol: req.secure ? 'https' : 'http',
      method: castTo(req.method),
      path: url.pathname!,
      query: Object.fromEntries(url.searchParams.entries()),
      params: req.params,
      headers: req.headers,
      inputStream: req,
      remoteIp: req.socket.remoteAddress,
      port: req.socket.localPort,
      async respond(value): Promise<void> {
        res.statusCode = value.statusCode ?? 200;
        res.setHeaders(value.headers.toMap());
        if (isReadable(value.output)) {
          await pipeline(value.output, res);
        } else {
          res.end(value.output);
        }
      }
    });
  }
}