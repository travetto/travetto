import { Inject, Injectable } from '@travetto/di';
import { AppError, Util } from '@travetto/runtime';

import {
  ControllerRegistry, WebInternal, EndpointUtil, HttpInterceptor, HttpContext, WebFilterNext, InterceptorGroup,
} from '@travetto/web';

import { WebRpcConfig } from './config.ts';

/**
 * Exposes functionality for RPC behavior
 */
@Injectable()
export class WebRpcInterceptor implements HttpInterceptor {

  dependsOn = [InterceptorGroup.Request];
  runsBefore = [InterceptorGroup.Response];

  @Inject()
  config: WebRpcConfig;

  /**
   * Ensures this is an opt-in interceptor
   */
  applies(): boolean {
    return false;
  }

  async intercept(ctx: HttpContext, next: WebFilterNext): Promise<void> {
    const { req, res } = ctx;

    const target = ctx.req.headerFirst('X-TRV-RPC');
    if (!target) {
      throw new AppError('RPC target required', { category: 'data' });
    }

    const endpoint = ControllerRegistry.getEndpointById(target);
    if (!endpoint) {
      throw new AppError('Unknown endpoint', { category: 'notfound' });
    }

    let params: unknown[];
    const paramInput = req.headerFirst('X-TRV-INPUTS');

    // Allow request to read inputs from header
    if (paramInput) {
      params = Util.decodeSafeJSON(paramInput)!;
    } else if (req.getContentType()?.full.includes('json')) {
      params = req.body;
      // Extract out body params if applicable
      if (Array.isArray(params)) {
        req.body = endpoint.params.find((x, i) => x.location === 'body' ? params[i] : undefined) ?? params; // Re-assign body
      }
    }

    params ??= [];

    if (!Array.isArray(params)) {
      throw new AppError('Invalid parameters, must be an array', { category: 'data' });
    }

    req[WebInternal].requestParams = endpoint.params.map((x, i) => (x.location === 'body' && paramInput) ? EndpointUtil.MISSING_PARAM : params[i]);
    // Dispatch
    await endpoint.handlerFinalized!(req, res);
  }
}