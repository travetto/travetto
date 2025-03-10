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

      if (SerializeUtil.isRenderable(output)) {
        result = await SerializeUtil.fromRenderable(res, output);
      } else if (output !== undefined && !res.headersSent) {
        result = SerializeUtil.serialize(output);
      }

      // On empty response
      if (result && !SerializeUtil.isStream(result.data) && result.data.length === 0) {
        res.statusCode ??= ((req.method === 'POST' || req.method === 'PUT') ? 201 : 204);
      }
    } catch (err) {
      const resolved = SerializeUtil.toError(err);
      console.error(resolved.message, { error: resolved });
      result = SerializeUtil.fromError(resolved);
    }

    if (!result) { // Nothing to do
      return;
    } else if (res.headersSent) { // Already sent, do nothing
      return console.error('Failed to send, already sent data');
    }

    await SerializeUtil.sendResult(res, result);
  }
}