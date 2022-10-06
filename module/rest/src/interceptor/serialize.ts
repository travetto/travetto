import { AppError } from '@travetto/base';
import { Injectable } from '@travetto/di';

import { RestInterceptor } from './types';
import { LoggingInterceptor } from './logging';

import { FilterContext, FilterNext } from '../types';
import { SerializeUtil } from './serialize-util';


const isUnknownError = (o: unknown): o is Record<string, unknown> & { message?: string } => !(o instanceof Error);

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
      console.warn(err);
      if (isUnknownError(err)) {  // Ensure we always throw "Errors"
        err = new AppError(err.message || 'Unexpected error', 'general', err);
      }
      await this.serialize(ctx, err);
    }
  }
}