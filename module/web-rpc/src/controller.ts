import { Inject } from '@travetto/di';
import { Any, AppError, Util } from '@travetto/runtime';
import {
  HeaderParam, Controller, All, Undocumented, ExcludeInterceptors, ControllerRegistry, WebContext,
  Body, EndpointUtil, BodyParseInterceptor
} from '@travetto/web';

@Controller('/rpc')
@Undocumented()
export class WebRpController {

  @Inject()
  ctx: WebContext;

  /**
   * RPC main entrypoint
   */
  @All('/:target')
  @ExcludeInterceptors(val => !(val instanceof BodyParseInterceptor || val.category === 'global'))
  async onRequest(target: string, @HeaderParam('X-TRV-RPC-INPUTS') paramInput?: string, @Body() body?: Any): Promise<unknown> {

    const endpoint = ControllerRegistry.getEndpointById(target);

    if (!endpoint) {
      throw new AppError('Unknown endpoint', { category: 'notfound' });
    }

    const bodyParamIdx = endpoint.params.findIndex((x) => x.location === 'body');

    const { req } = this.ctx;

    let params: unknown[];

    // Allow request to read inputs from header
    if (paramInput) {
      params = Util.decodeSafeJSON(paramInput)!;
    } else if (Array.isArray(body)) { // Params passed via body
      params = body;
      if (bodyParamIdx >= 0) { // Re-assign body
        req.body = params[bodyParamIdx];
      }
    } else if (body) {
      throw new AppError('Invalid parameters, must be an array', { category: 'data' });
    } else {
      params = [];
    }

    req.getInternal().requestParams = endpoint.params.map((x, i) => (x.location === 'body' && paramInput) ? EndpointUtil.MissingParamSymbol : params[i]);

    // Dispatch
    return await endpoint.filter!({ req: this.ctx.req });
  }
}