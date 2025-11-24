import { Inject } from '@travetto/di';
import { Any, AppError, Util } from '@travetto/runtime';
import {
  HeaderParam, Controller, Undocumented, ExcludeInterceptors, ControllerRegistryIndex,
  WebAsyncContext, Body, EndpointUtil, BodyInterceptor, Post, WebCommonUtil,
  RespondInterceptor, DecompressInterceptor, Get
} from '@travetto/web';

@Controller('/rpc')
@ExcludeInterceptors(val => !(
  val instanceof DecompressInterceptor ||
  val instanceof BodyInterceptor ||
  val instanceof RespondInterceptor ||
  val.category === 'global'
))
@Undocumented()
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
      params = Util.decodeSafeJSON(paramInput)!;
    } else if (Array.isArray(body)) { // Params passed via body
      params = body;

      const bodyParamIdx = endpoint.parameters.findIndex((x) => x.location === 'body');
      if (bodyParamIdx >= 0) { // Re-assign body
        request.body = params[bodyParamIdx];
      }
    } else if (body) {
      throw new AppError('Invalid parameters, must be an array', { category: 'data' });
    } else {
      params = [];
    }

    const final = endpoint.parameters.map((x, i) => (x.location === 'body' && paramInput) ? EndpointUtil.MissingParamSymbol : params[i]);
    WebCommonUtil.setRequestParams(request, final);

    // Dispatch
    return endpoint.filter({ request });
  }
}