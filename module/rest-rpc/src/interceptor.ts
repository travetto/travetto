import { Injectable, Inject } from '@travetto/di';
import { AppError } from '@travetto/runtime';

import { MissingParamⲐ, RequestParamsⲐ, RequestLoggingⲐ } from '@travetto/rest/src/internal/symbol';
import {
  BodyParseInterceptor, LoggingInterceptor, RouteConfig, FilterContext, FilterNext, ControllerRegistry,
  RestInterceptor
} from '@travetto/rest';
import { SerializeUtil } from '@travetto/rest/src/interceptor/serialize-util';
import { RestRpcConfig } from './config';


/**
 * Exposes functionality for RPC behavior
 */
@Injectable()
export class RestRpcInterceptor implements RestInterceptor<RestRpcConfig> {

  after = [BodyParseInterceptor];
  before = [LoggingInterceptor];

  @Inject()
  config: RestRpcConfig;

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
      return SerializeUtil.serializeError(res, new AppError('Unknown endpoint'));
    }

    const params = req.body ?? [];
    if (!Array.isArray(params)) {
      return SerializeUtil.serializeError(res, new AppError('Invalid parameters, must be an array'));
    }

    req[RequestLoggingⲐ] = { controller: ep.class.name, endpoint: ep.handlerName };
    req[RequestParamsⲐ] = ep.params.map((x, i) => x.location === 'context' ? MissingParamⲐ : params[i]);
    req.body = ep.params.find((x, i) => x.location === 'body' ? params[i] : undefined) ?? params; // Re-assign body

    return await ep.handlerFinalized!(req, res);
  }
}