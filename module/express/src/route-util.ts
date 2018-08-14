import { ConfigLoader } from '@travetto/config';

import { Request, Response, NextFunction } from 'express';
import { MimeType, isRenderable } from './model';
import { ControllerConfig, EndpointConfig, HeaderMap } from './types';
import { ExpressConfig } from './service';

const expressCfg = new ExpressConfig();
ConfigLoader.bindTo(expressCfg, 'express');

export class RouteUtil {

  static canAccept(req: Request, mime: string) {
    return (req.headers['accept'] || '').indexOf(mime) >= 0;
  }

  static logRequest(req: Request, res: Response) {
    const reqLog = {
      meta: {
        method: req.method,
        path: req.path,
        query: req.query,
        params: req.params,
        statusCode: res.statusCode
      }
    };

    if (reqLog.meta.statusCode < 400) {
      console.log(`Request`, reqLog);
    } else {
      console.error(`Request`, reqLog);
    }
  }

  static async sendOutput(req: Request, res: Response, output: any, headers?: HeaderMap) {
    if (!res.headersSent) {
      if (headers) {
        for (const [h, v] of Object.entries(headers)) {
          res.setHeader(h, typeof v === 'string' ? v : v());
        }
      }

      if (output) {
        if (isRenderable(output)) {
          await output.render(res);
        } else if (typeof output === 'string') {
          res.type(MimeType.TEXT);
          res.send(output);
        } else if ('toJSON' in output) {
          res.type(MimeType.JSON);
          res.send((output as any).toJSON());
        } else {
          res.json(output);
        }
      }
    }

    res.end();
  }

  static createRouteHandler(cConfig: ControllerConfig, endpoint: EndpointConfig) {
    const { class: cls, headers: cHeaders } = cConfig;
    const { instance, handler, headers: eHeaders } = endpoint;

    const ops = [
      ...cConfig.filters.map(x => x.bind(cls)),
      ...endpoint.filters.map(x => x.bind(instance))
    ];

    const handlerBound = handler.bind(instance);

    const headers = { ...cHeaders, ...eHeaders };

    if (endpoint.method === 'get' && expressCfg.disableGetCache) {
      // Override if not set
      if (!('Expires' in headers) && !('Cache-Control' in headers)) {
        Object.assign(headers, {
          Expires: '-1',
          'Cache-Control': 'max-age=0, no-cache'
        });
      }
    }

    return async (req: Request, res: Response, next: NextFunction) => {

      try {
        for (const filter of ops) {
          await filter(req, res);
        }
        const output = await handlerBound(req, res);
        await RouteUtil.sendOutput(req, res, output, headers);
      } catch (error) {
        await RouteUtil.sendOutput(req, res, error);
      }

      RouteUtil.logRequest(req, res);
    };
  }
}