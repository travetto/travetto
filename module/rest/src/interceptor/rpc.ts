import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError } from '@travetto/base';

import { FilterContext, FilterNext, RouteConfig } from '../types';

import { ManagedInterceptorConfig, RestInterceptor } from './types';
import { LoggingInterceptor } from './logging';
import { BodyParseInterceptor } from './body-parse';
import { ControllerRegistry } from '../registry/controller';
import { MissingParamⲐ, RequestParamsⲐ, RequestLoggingⲐ } from '../internal/symbol';
import { SerializeUtil } from './serialize-util';

export type RestRpcCommand = {
  controller: string;
  method: string;
  params?: unknown[];
  /** @deprecated */
  args?: unknown[];
};

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

  applies(route: RouteConfig, config?: { basePath: string }): boolean {
    return route.path === '*';
  }

  async intercept({ req, res }: FilterContext<RestRpcConfig>, next: FilterNext): Promise<unknown> {
    if (!req.header('X-RPC')) {
      return await next();
    }

    const cmd: RestRpcCommand = req.body;
    const cls = ControllerRegistry.getClasses().find(x => x.name.endsWith(cmd.controller));
    if (!cls) {
      return SerializeUtil.serializeError(res, new AppError('Unknown controller'));
    }

    const ctrl = await ControllerRegistry.get(cls);
    const ep = ctrl.endpoints.find(x => x.handlerName === cmd.method);
    if (!ep) {
      return SerializeUtil.serializeError(res, new AppError('Unknown endpoint'));
    }

    const params = cmd.params ?? cmd.args ?? [];

    req[RequestLoggingⲐ] = { controller: ctrl.class.name, handler: ep.handlerName };
    req[RequestParamsⲐ] = ep.params.map((x, i) => x.location === 'context' ? MissingParamⲐ : params[i]);

    return await ep.handlerFinalized!(req, res);
  }
}