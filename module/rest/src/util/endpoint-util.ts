import { ConfigLoader } from '@travetto/config';
import { AppError } from '@travetto/base';

import { isRenderable } from '../response/renderable';
import { MimeType } from '../util/mime';
import { ControllerConfig, EndpointConfig, HeaderMap, Request, Response, RestInterceptor } from '../types';
import { RestConfig } from '../config';

const restCfg = new RestConfig();
ConfigLoader.bindTo(restCfg, 'rest');

export class EndpointUtil {

  static logRequest(req: Request, res: Response) {
    const reqLog = {
      meta: {
        method: req.method,
        path: req.baseUrl ? `${req.baseUrl}${req.path}`.replace(/\/+/, '/') : req.path,
        query: req.query,
        params: req.params,
        statusCode: res.statusCode
      }
    };

    if (reqLog.meta.statusCode < 400) {
      console.info(`Request`, reqLog);
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
          res.setHeader('Content-Type', MimeType.TEXT);
          res.send(output);
        } else if ('toJSON' in output) {
          res.setHeader('Content-Type', MimeType.JSON);
          res.send((output as any).toJSON());
        } else {
          res.setHeader('Content-Type', MimeType.JSON);
          res.send(JSON.stringify(output as any, undefined, 'pretty' in req.query ? 2 : 0));
        }
      } else {
        res.status(201);
      }
    }

    res.end();
  }

  static createEndpointHandler(cConfig: ControllerConfig, endpoint: EndpointConfig, interceptors: RestInterceptor[]) {
    const { class: cls, headers: cHeaders } = cConfig;
    const { instance, handler, headers: eHeaders } = endpoint;

    const ops = [
      ...cConfig.filters.map(x => x.bind(cls)),
      ...endpoint.filters.map(x => x.bind(instance))
    ];

    const handlerBound = handler.bind(instance);

    const headers = { ...cHeaders, ...eHeaders };

    if (endpoint.method === 'get' && restCfg.disableGetCache) {
      // Override if not set
      if (!('Expires' in headers) && !('Cache-Control' in headers)) {
        Object.assign(headers, {
          Expires: '-1',
          'Cache-Control': 'max-age=0, no-cache'
        });
      }
    }

    return async (req: Request, res: Response) => {

      try {
        for (const inter of interceptors) {
          await inter.intercept(req, res);
        }
        for (const filter of ops) {
          await filter(req, res);
        }
        const output = await handlerBound(req, res);
        await EndpointUtil.sendOutput(req, res, output, headers);
      } catch (error) {
        if (!(error instanceof Error)) {  // Ensure we always throw "Errors"
          error = new AppError(error.message || 'Unexpected error', 'general', error);
        }
        await EndpointUtil.sendOutput(req, res, error);
      } finally {
        EndpointUtil.logRequest(req, res);
      }
    };
  }
}