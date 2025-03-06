import { Injectable, Inject } from '@travetto/di';
import { AppError, Util } from '@travetto/runtime';

import {
  BodyParseInterceptor, LoggingInterceptor, FilterContext, FilterNext, ControllerRegistry,
  HttpInterceptor, SerializeInterceptor, WebSymbols, SerializeUtil, EndpointConfig
} from '@travetto/web';

import { WebRpcConfig } from './config';

/**
 * Exposes functionality for RPC behavior
 */
@Injectable()
export class WebRpcInterceptor implements HttpInterceptor<WebRpcConfig> {

  runsBefore = [LoggingInterceptor, SerializeInterceptor];

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

    const ep = ControllerRegistry.getEndpointByNames(target);

    if (!ep) {
      return SerializeUtil.serializeError(req, res, new AppError('Unknown endpoint'));
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
        req.body = ep.params.find((x, i) => x.location === 'body' ? params[i] : undefined) ?? params; // Re-assign body
      }
    }

    params ??= [];

    if (!Array.isArray(params)) {
      return SerializeUtil.serializeError(req, res, new AppError('Invalid parameters, must be an array'));
    }

    req[WebSymbols.RequestLogging] = { controller: ep.class.name, endpoint: ep.handlerName };
    req[WebSymbols.RequestParams] = ep.params.map((x, i) => (x.location === 'body' && isBinary) ? WebSymbols.MissingParam : params[i]);
    return await ep.handlerFinalized!(req, res);
  }
}