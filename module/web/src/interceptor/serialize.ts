import { Injectable } from '@travetto/di';
import { AppError } from '@travetto/runtime';
import { DataUtil } from '@travetto/schema';

import { HttpInterceptor } from './types';
import { FilterContext, FilterNext, HttpPayload } from '../types';
import { SerializeUtil } from '../util/serialize';

/**
 * Serialization interceptor
 */
@Injectable()
export class SerializeInterceptor implements HttpInterceptor {

  async intercept({ res, req }: FilterContext, next: FilterNext): Promise<void> {
    let result: HttpPayload | undefined;

    try {
      const output = await next();
      if (SerializeUtil.isSerializable(output)) {
        result = await output.serialize(res);
      } else {
        result = SerializeUtil.serialize(output);
      }
    } catch (error) {
      const resolved = error instanceof Error ? error :
        !DataUtil.isPlainObject(error) ? new AppError(`${error}`) :
          new AppError(`${error['message'] || 'Unexpected error'}`, { details: error });

      console.error(resolved.message, { error: resolved });
      result = SerializeUtil.fromError(resolved);
    }

    if (!result) {
      return; // Nothing to return
    } else if (res.headersSent) {
      return console.error('Failed to send, already sent data');
    } else {
      if (result.length === 0) { // On empty response
        res.statusCode ??= ((req.method === 'POST' || req.method === 'PUT') ? 201 : 204);
      }
      await SerializeUtil.send(res, result);
    }
  }
}