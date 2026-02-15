import { Inject } from '@travetto/di';
import { type Any, AppError, JSONUtil } from '@travetto/runtime';
import { IsPrivate } from '@travetto/schema';
import {
  HeaderParam, Controller, ExcludeInterceptors, ControllerRegistryIndex,
  type WebAsyncContext, Body, EndpointUtil, BodyInterceptor, Post, WebCommonUtil,
  RespondInterceptor, DecompressInterceptor, Get
} from '@travetto/web';

@Controller('/rpc')
@ExcludeInterceptors(value => !(
  value instanceof DecompressInterceptor ||
  value instanceof BodyInterceptor ||
  value instanceof RespondInterceptor ||
  value.category === 'global'
))
@IsPrivate()
export class WebRpcController {

  @Inject()
  ctx: WebAsyncContext;

  /**
   * Allow for get-based requests
   */
  @Get('/:target')
  async onGetRequest(target: string, @HeaderParam('X-TRV-RPC-INPUTS') paramInput?: string): Promise<unknown> {
    return this.onRequest(target, paramInput);
  }

  /**
   * RPC main entrypoint
   */
  @Post('/:target')
  async onRequest(target: string, @HeaderParam('X-TRV-RPC-INPUTS') paramInput?: string, @Body() body?: Any): Promise<unknown> {
    const endpoint = ControllerRegistryIndex.getEndpointConfigById(target);

    if (!endpoint || !endpoint.filter) {
      throw new AppError('Unknown endpoint', { category: 'notfound' });
    }

    const { request } = this.ctx;

    let params: unknown[];

    // Allow request to read inputs from header
    if (paramInput) {
      params = JSONUtil.fromBase64(paramInput);
    } else if (Array.isArray(body)) { // Params passed via body
      params = body;

      const bodyParamIdx = endpoint.parameters.findIndex((config) => config.location === 'body');
      if (bodyParamIdx >= 0) { // Re-assign body
        request.body = params[bodyParamIdx];
      }
    } else if (body) {
      throw new AppError('Invalid parameters, must be an array', { category: 'data' });
    } else {
      params = [];
    }

    const final = endpoint.parameters.map((config, i) => (config.location === 'body' && paramInput) ? EndpointUtil.MissingParamSymbol : params[i]);
    WebCommonUtil.setRequestParams(request, final);

    // Dispatch
    return endpoint.filter({ request });
  }
}