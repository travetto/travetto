import { Inject } from '@travetto/di';
import { Any, AppError, Util } from '@travetto/runtime';
import {
  HeaderParam, Controller, Undocumented, ExcludeInterceptors, ControllerRegistry,
  WebAsyncContext, Body, EndpointUtil, BodyParseInterceptor, Post, WebCommonUtil,
  RespondInterceptor
} from '@travetto/web';

@Controller('/rpc')
@ExcludeInterceptors(val => !(val instanceof BodyParseInterceptor || val instanceof RespondInterceptor || val.category === 'global'))
@Undocumented()
export class WebRpController {

  @Inject()
  ctx: WebAsyncContext;

  /**
   * RPC main entrypoint
   */
  @Post('/:target')
  async onRequest(target: string, @HeaderParam('X-TRV-RPC-INPUTS') paramInput?: string, @Body() body?: Any): Promise<unknown> {
    const endpoint = ControllerRegistry.getEndpointById(target);

    if (!endpoint) {
      throw new AppError('Unknown endpoint', { category: 'notfound' });
    }

    const bodyParamIdx = endpoint.params.findIndex((x) => x.location === 'body');

    const { request } = this.ctx;

    let params: unknown[];

    // Allow request to read inputs from header
    if (paramInput) {
      params = Util.decodeSafeJSON(paramInput)!;
    } else if (Array.isArray(body)) { // Params passed via body
      params = body;
      if (bodyParamIdx >= 0) { // Re-assign body
        request.body = params[bodyParamIdx];
      }
    } else if (body) {
      throw new AppError('Invalid parameters, must be an array', { category: 'data' });
    } else {
      params = [];
    }

    const final = endpoint.params.map((x, i) => (x.location === 'body' && paramInput) ? EndpointUtil.MissingParamSymbol : params[i]);
    WebCommonUtil.setRequestParams(request, final);

    // Dispatch
    return await endpoint.filter!({ request: this.ctx.request });
  }
}