import type express from 'express';

import { RestServerUtil, Request, Response } from '@travetto/rest';
import { NodeEntityⲐ, ProviderEntityⲐ } from '@travetto/rest/src/internal/symbol';
import { castTo } from '@travetto/runtime';

/**
 * Provide a mapping between express request/response and the framework analogs
 */
export class ExpressServerUtil {
  /**
   * Build a Travetto Request from an Express Request
   */
  static getRequest(req: express.Request & { session?: TravettoRequest['session'] }): Request {
    return RestServerUtil.decorateRequest<Request>({
      [ProviderEntityⲐ]: req,
      [NodeEntityⲐ]: req,
      protocol: castTo(req.protocol),
      method: castTo(req.method),
      url: req.originalUrl,
      query: req.query,
      params: req.params,
      session: req.session,
      headers: req.headers,
      pipe: req.pipe.bind(req),
      on: req.on.bind(req)
    });
  }

  /**
   * Build a Travetto Response from an Express Response
   */
  static getResponse(res: express.Response): Response {
    return RestServerUtil.decorateResponse<Response>({
      [ProviderEntityⲐ]: res,
      [NodeEntityⲐ]: res,
      get headersSent(): boolean {
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
      send(data): void {
        const contentType = res.getHeader('Content-Type');
        if (typeof contentType === 'string' && contentType.includes('json') && typeof data === 'string') {
          data = Buffer.from(data);
        }
        res.send(data);
      },
      on: res.on.bind(res),
      end: (val?: unknown): void => {
        if (val) {
          res.send(val);
        }
        res.end();
      },
      getHeaderNames: res.getHeaderNames.bind(res),
      setHeader: res.setHeader.bind(res),
      getHeader: castTo(res.getHeader.bind(res)), // NOTE: Forcing type, may be incorrect
      removeHeader: res.removeHeader.bind(res),
      write: res.write.bind(res)
    });
  }
}