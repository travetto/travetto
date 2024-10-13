import { AppError } from '@travetto/runtime';
import { Injectable } from '@travetto/di';
import { DataUtil } from '@travetto/schema';

import { RestInterceptor } from './types';

import { FilterContext, FilterNext } from '../types';
import { SerializeUtil } from './serialize-util';

/**
 * Serialization interceptor
 */
@Injectable()
export class SerializeInterceptor implements RestInterceptor {

  async intercept(ctx: FilterContext, next: FilterNext): Promise<void> {
    try {
      const output = await next();
      if (!ctx.res.headersSent) {
        await SerializeUtil.serializeStandard(ctx.req, ctx.res, output);
      }
    } catch (err) {
      const resolved = err instanceof Error ? err : (
        DataUtil.isPlainObject(err) ?
          new AppError(`${err['message'] || 'Unexpected error'}`, { details: err }) :
          new AppError(`${err}`)
      );
      if (ctx.res.headersSent) {
        console.error('Failed to serialize, already sent partially', resolved);
      } else {
        await SerializeUtil.serializeError(ctx.res, resolved);
      }
    }
  }
}