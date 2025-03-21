import { IncomingMessage } from 'node:http';

import { Inject } from '@travetto/di';
import { Any, AppError, Util } from '@travetto/runtime';
import {
  HeaderParam, Controller, All, Undocumented, ExcludeInterceptors,
  ControllerRegistry, WebContext, Body, WebInternal, EndpointUtil,
  BodyParseInterceptor
} from '@travetto/web';

/**
 * Declares endpoint functionality for RPC behavior
 */
@Controller('/rpc')
@Undocumented()
export class WebRpController {

  @Inject()
  ctx: WebContext;

  @All('/:target')
  @ExcludeInterceptors(val => !(val instanceof BodyParseInterceptor || val.category === 'global'))
  async onRequest(target: string, @HeaderParam('X-TRV-RPC-INPUTS') paramInput?: string, @Body() body?: Any): Promise<void> {

    const endpoint = ControllerRegistry.getEndpointById(target);

    if (!endpoint) {
      throw new AppError('Unknown endpoint', { category: 'notfound' });
    }

    const { req, res } = this.ctx;

    let params: unknown[];
    // Allow request to read inputs from header
    if (paramInput) {
      params = Util.decodeSafeJSON(paramInput)!;
    } else if (body && !(body instanceof IncomingMessage)) {
      params = body;
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