import { AppError } from '@travetto/runtime';
import { Injectable } from '@travetto/di';
import { DataUtil } from '@travetto/schema';

import { RestInterceptor } from './types';
import { LoggingInterceptor } from './logging';

import { FilterContext, FilterNext } from '../types';
import { SerializeUtil } from './serialize-util';

/**
 * Serialization interceptor
 */
@Injectable()
export class SerializeInterceptor implements RestInterceptor {

  after = [LoggingInterceptor];

  /**
   * Send output to the response
   * @param output The value to output
   */
  async serialize({ req, res }: FilterContext, output: unknown): Promise<void> {
    if (SerializeUtil.isRenderable(output)) {
      if (output.headers) {
        for (const [k, v] of Object.entries(output.headers())) {
          res.setHeader(k, v);
        }
      }
      if (output.statusCode) {
        res.status(output.statusCode());
      }
      output = await output.render(res);
      if (output === undefined) { // If render didn't return a result, consider us done
        return;
      }
    }

    return SerializeUtil.serializeStandard(req, res, output);
  }

  async intercept(ctx: FilterContext, next: FilterNext): Promise<void> {
    try {
      const output = await next();

      if (!ctx.res.headersSent) {
        await this.serialize(ctx, output);
      }
    } catch (err) {
      const resolved = err instanceof Error ? err : (
        DataUtil.isPlainObject(err) ?
          new AppError(`${err['message'] || 'Unexpected error'}`, 'general', err) :
          new AppError(`${err}`, 'general')
      );
      if (ctx.res.headersSent) {
        console.error('Failed to serialize, already sent partially', resolved);
      } else {
        await SerializeUtil.serializeError(ctx.res, resolved);
      }
    }
  }
}