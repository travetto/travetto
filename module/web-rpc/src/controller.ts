import { Inject } from '@travetto/di';
import { AppError, Util } from '@travetto/runtime';

import {
  ControllerRegistry, WebInternal, EndpointUtil, Controller, All,
  HeaderParam, WebContext, ConfigureInterceptor, LoggingInterceptor,
} from '@travetto/web';

import { WebRpcConfig } from './config.ts';

/**
 * Exposes functionality for RPC behavior
 */
@Controller('/rpc', { documented: false })
@ConfigureInterceptor(LoggingInterceptor, { disabled: true })
export class WebRpController {

  @Inject()
  config: WebRpcConfig;

  @Inject()
  webCtx: WebContext;

  @All('/')
  async onRequest(
    @HeaderParam('X-TRV-RPC') target: string,
    @HeaderParam('X-TRV-INPUTS') paramInput?: string
  ): Promise<void> {
    const endpoint = ControllerRegistry.getEndpointById(target);

    if (!endpoint) {
      throw new AppError('Unknown endpoint', { category: 'notfound' });
    }

    const req = this.webCtx.request;
    const res = this.webCtx.response;

    let params: unknown[];

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