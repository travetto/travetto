import { Injectable, Inject } from '@travetto/di';
import { AppError, Util } from '@travetto/runtime';

import { MissingParamSymbol, RequestParamsSymbol, RequestLoggingSymbol } from '@travetto/rest/src/internal/symbol';
import {
  BodyParseInterceptor, LoggingInterceptor, RouteConfig, FilterContext, FilterNext, ControllerRegistry,
  RestInterceptor, SerializeInterceptor
} from '@travetto/rest';
import { SerializeUtil } from '@travetto/rest/src/util/serialize';
import { RestRpcConfig } from './config';

/**
 * Exposes functionality for RPC behavior
 */
@Injectable()
export class RestRpcInterceptor implements RestInterceptor<RestRpcConfig> {

  runsBefore = [LoggingInterceptor, SerializeInterceptor];

  @Inject()
  config: RestRpcConfig;

  @Inject()
  body: BodyParseInterceptor;

  applies(route: RouteConfig): boolean {
    // Global handler
    return route.path === '*';
  }

  async intercept({ req, res }: FilterContext<RestRpcConfig>, next: FilterNext): Promise<unknown> {
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

    req[RequestLoggingSymbol] = { controller: ep.class.name, endpoint: ep.handlerName };
    req[RequestParamsSymbol] = ep.params.map((x, i) =>
      (x.location === 'context' || (x.location === 'body' && isBinary)) ? MissingParamSymbol : params[i]);

    return await ep.handlerFinalized!(req, res);
  }
}