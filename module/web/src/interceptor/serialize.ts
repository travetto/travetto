import { Injectable } from '@travetto/di';
import { hasFunction } from '@travetto/runtime';

import { HttpSerializable } from '../response/serializable.ts';
import { HttpInterceptor } from './types.ts';
import { FilterContext, FilterNext } from '../types.ts';
import { HttpPayloadUtil } from '../util/payload.ts';

const isSerializable = hasFunction<HttpSerializable>('serialize');

/**
 * Serialization interceptor
 */
@Injectable()
export class SerializeInterceptor implements HttpInterceptor {

  async intercept({ res, req }: FilterContext, next: FilterNext): Promise<unknown> {
    const output = await next();
    if (isSerializable(output)) {
      await output.serialize(res);
    } else {
      const payload = HttpPayloadUtil.from(output);
      HttpPayloadUtil.applyPayload(payload, req, res);
      return;
    }
  }
}