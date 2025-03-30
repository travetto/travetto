import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

import type express from 'express';

import { HttpRequest } from '@travetto/web';
import { castTo, hasFunction } from '@travetto/runtime';

const isReadable = hasFunction<Readable>('pipe');

/**
 * Provide a mapping between express request/response and the framework analogs
 */
export class ExpressWebServerUtil {

  /**
   * Build a Travetto HttpRequest from an Express Request
   */
  static getRequest(req: express.Request, res: express.Response): HttpRequest {
    return new HttpRequest({
      protocol: castTo(req.protocol),
      method: castTo(req.method.toUpperCase()),
      path: req.originalUrl,
      query: req.query,
      params: req.params,
      headers: req.headers,
      remoteIp: req.socket.remoteAddress,
      port: req.socket.localPort,
      inputStream: req,
      body: req.body,
      async respond(value): Promise<void> {
        res.status(value.statusCode ?? 200);
        value.headers.forEach((v, k) => res.setHeader(k, v));
        if (isReadable(value.output)) {
          await pipeline(value.output, res, { end: false });
          res.end();
        } else {
          res.end(value.output);
        }
      },
    });
  }
}