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
      method: req.method,
      url: req.originalUrl,
      path: req.url,
      query: req.query,
      params: req.params,
      headers: req.headers,
      remoteIp: req.socket.remoteAddress,
      port: req.socket.localPort,
      inputStream: req,
      body: req.body,
      respond(value): unknown {
        res.status(value.statusCode ?? 200);
        res.setHeaders(value.headers.toMap());
        if (isReadable(value.output)) {
          return pipeline(value.output, res);
        } else {
          res.end(value.output);
        }
      },
    });
  }
}