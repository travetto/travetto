import * as express from 'express';

import { RestServerUtil, Request, Response } from '@travetto/rest';
import { NodeEntityⲐ, ProviderEntityⲐ } from '@travetto/rest/src/internal/symbol';

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
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      protocol: req.protocol as 'http',
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      method: req.method as Request['method'],
      url: req.originalUrl,
      query: req.query,
      params: req.params,
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
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const contentType: string = (res.getHeader('Content-Type') as string) ?? '';
        if (contentType.includes('json') && typeof data === 'string') {
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
      setHeader: res.setHeader.bind(res),
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      getHeader: res.getHeader.bind(res) as (key: string) => string | string[] | undefined, // NOTE: Forcing type, may be incorrect
      removeHeader: res.removeHeader.bind(res),
      write: res.write.bind(res)
    });
  }
}