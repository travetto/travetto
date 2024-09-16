import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError } from '@travetto/runtime';

import { FilterContext, FilterNext, RouteConfig } from '../types';

import { ManagedInterceptorConfig, RestInterceptor } from './types';
import { LoggingInterceptor } from './logging';
import { BodyParseInterceptor } from './body-parse';
import { ControllerRegistry } from '../registry/controller';
import { MissingParamⲐ, RequestParamsⲐ, RequestLoggingⲐ } from '../internal/symbol';
import { SerializeUtil } from './serialize-util';

/**
 * Rest body parse configuration
 */
@Config('rest.rpc')
export class RestRpcConfig extends ManagedInterceptorConfig { }

/**
 * Exposes functionality for RPC behavior
 */
@Injectable()
export class RpcInterceptor implements RestInterceptor<RestRpcConfig> {

  after = [BodyParseInterceptor];
  before = [LoggingInterceptor];

  @Inject()
  config: RestRpcConfig;

  applies(route: RouteConfig): boolean {
    // Global handler
    return route.path === '*';
  }

  async intercept({ req, res }: FilterContext<RestRpcConfig>, next: FilterNext): Promise<unknown> {
    const target = req.headerFirst('X-TRV-RPC')?.split(/[#:.]/);
    if (target?.length !== 2) {
      return await next();
    }

    const [controller, endpoint] = target;
    const ep = ControllerRegistry.getEndpointByNames(controller, endpoint);

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