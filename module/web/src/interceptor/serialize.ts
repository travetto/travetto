import { Injectable } from '@travetto/di';

import { HttpInterceptor } from './types';
import { FilterContext, FilterNext } from '../types';
import { SerializedResult, SerializeUtil } from '../util/serialize';

/**
 * Serialization interceptor
 */
@Injectable()
export class SerializeInterceptor implements HttpInterceptor {

  async intercept({ res, req }: FilterContext, next: FilterNext): Promise<void> {
    let result: SerializedResult | undefined;

    try {
      const output = await next();

      if (output !== undefined && !res.headersSent) {
        if (SerializeUtil.isRenderable(output)) {
          result = await SerializeUtil.fromRenderable(res, output);
        } else {
          result = SerializeUtil.serialize(output);
        }
      }

      // On empty response
      if (!res.headersSent && result?.length === 0) {
        res.statusCode ??= ((req.method === 'POST' || req.method === 'PUT') ? 201 : 204);
      }
    } catch (err) {
      const resolved = SerializeUtil.toError(err);
      console.error(resolved.message, { error: resolved });
      result = SerializeUtil.fromError(resolved);
    }

    await SerializeUtil.sendResult(res, result);
  }
}