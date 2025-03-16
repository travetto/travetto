import { Injectable, Inject } from '@travetto/di';
import { AppError, Util } from '@travetto/runtime';

import {
  BodyParseInterceptor, FilterContext, FilterNext, ControllerRegistry, HttpInterceptor, WebInternal, EndpointConfig,
  EndpointUtil
} from '@travetto/web';

import { WebRpcConfig } from './config.ts';

/**
 * Exposes functionality for RPC behavior
 */
@Injectable()
export class WebRpcInterceptor implements HttpInterceptor<WebRpcConfig> {

  runsBefore = [BodyParseInterceptor];

  @Inject()
  config: WebRpcConfig;

  @Inject()
  body: BodyParseInterceptor;

  applies(endpoint: EndpointConfig): boolean {
    // Global handler
    return endpoint.path === '*';
  }

  async intercept({ req, res }: FilterContext<WebRpcConfig>, next: FilterNext): Promise<unknown> {
    const target = req.headerFirst('X-TRV-RPC')?.trim();
    if (!target) {
      return await next();
    }

    const endpoint = ControllerRegistry.getEndpointById(target);

    if (!endpoint) {
      throw new AppError('Unknown endpoint');
    }

    let params: unknown[];

    // Allow request to read inputs from header, if body isn't JSON
    const isBinary = req.getContentType()?.full !== 'application/json';
    if (isBinary) {
      const data = req.headerFirst('X-TRV-RPC-INPUTS')?.trim();
      if (data) {
        params = Util.decodeSafeJSON(data)!;
      }
    } else {
      await this.body.intercept({ req, res, config: this.body.config }, () => { });
      params = req.body;
      if (Array.isArray(params)) {
        req.body = endpoint.params.find((x, i) => x.location === 'body' ? params[i] : undefined) ?? params; // Re-assign body
      }
    }

    params ??= [];

    if (!Array.isArray(params)) {
      throw new AppError('Invalid parameters, must be an array');
    }

    req[WebInternal].requestLogging = false; // Disable logging on sub request
    req[WebInternal].requestParams = endpoint.params.map((x, i) => (x.location === 'body' && isBinary) ? EndpointUtil.MISSING_PARAM : params[i]);
    try {
      return await endpoint.handlerFinalized!(req, res);
    } finally {
      req[WebInternal].requestLogging = { controller: endpoint.class.name, endpoint: endpoint.handlerName };
    }
  }
}