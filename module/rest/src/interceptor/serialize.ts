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

  async intercept(ctx: FilterContext, next: FilterNext): Promise<void> {
    try {
      const output = await next();
      await SerializeUtil.sendOutput(ctx, output);
    } catch (err) {
      console.warn(err);
      if (isUnknownError(err)) {  // Ensure we always throw "Errors"
        err = new AppError(err.message || 'Unexpected error', 'general', err);
      }
      await SerializeUtil.sendOutput(ctx, err);
    }
  }
}