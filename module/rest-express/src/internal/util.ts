import * as express from 'express';

import { RestServerUtil, Request } from '@travetto/rest';
import { NodeEntitySym, ProviderEntitySym } from '@travetto/rest/src/internal/symbol';
import { Response } from '@travetto/rest/src/types';

/**
 * Provide a mapping between express request/response and the framework analogs
 */
export class ExpressServerUtil {
  /**
   * Build a Travetto Request from an Express Request
   */
  static getRequest(req: express.Request & { session?: TravettoRequest['session'] }) {
    return RestServerUtil.decorateRequest<Request>({
      [ProviderEntitySym]: req,
      [NodeEntitySym]: req,
      protocol: req.protocol as 'http',
      method: req.method as Request['method'],
      url: req.originalUrl,
      query: req.query as Record<string, string>,
      params: req.params as Record<string, string>,
      body: req.body,
      session: req.session,
      headers: req.headers,
      files: undefined,
      auth: undefined,
      pipe: req.pipe.bind(req),
      on: req.on.bind(req)
    });
  }

  /**
   * Build a Travetto Response from an Express Response
   */
  static getResponse(res: express.Response) {
    return RestServerUtil.decorateResponse<Response>({
      [ProviderEntitySym]: res,
      [NodeEntitySym]: res,
      get headersSent() {
        return res.headersSent;
      },
      status(val?: number): number | undefined {
        if (val) {
          res.status(val);
          res.statusCode = val;
        } else {
          return res.statusCode;
        }
      },
      send(data) {
        if ((res.getHeader('Content-Type') as string ?? '').includes('json') && typeof data === 'string') {
          data = Buffer.from(data);
        }
        res.send(data);
      },
      on: res.on.bind(res),
      end: (val?: unknown) => {
        if (val) {
          res.send(val);
        }
        res.end();
      },
      setHeader: res.setHeader.bind(res),
      getHeader: res.getHeader.bind(res) as (key: string) => string, // NOTE: Forcing type, may be incorrect
      removeHeader: res.removeHeader.bind(res),
      write: res.write.bind(res)
    });
  }
}