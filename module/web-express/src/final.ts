import type { Response } from 'express';

import { type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { Injectable } from '@travetto/di';
import { castTo, hasFunction } from '@travetto/runtime';
import { FilterContext, FilterNext, HttpInterceptor, LoggingInterceptor, WebInternal } from '@travetto/web';

const isReadable = hasFunction<Readable>('pipe');

@Injectable()
export class FinalInterceptor implements HttpInterceptor {
  runsBefore = [LoggingInterceptor];

  async intercept(ctx: FilterContext, next: FilterNext): Promise<unknown> {
    try {
      return await next();
    } finally {
      const { body, providerEntity } = ctx.res[WebInternal];

      const res = castTo<Response>(providerEntity);
      if (isReadable(body)) {
        await pipeline(body, res);
      } else {
        res.send(body);
        res.end();
      }
    }
  }
}