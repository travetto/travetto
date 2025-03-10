import { AppError } from '@travetto/runtime';
import { Injectable } from '@travetto/di';
import { DataUtil } from '@travetto/schema';

import { HttpInterceptor } from './types';
import { FilterContext, FilterNext } from '../types';
import { SerializedResult, SerializeUtil } from '../util/serialize';
import { WebSymbols } from '../symbols';

/**
 * Serialization interceptor
 */
@Injectable()
export class SerializeInterceptor implements HttpInterceptor {

  async intercept({ res, req }: FilterContext, next: FilterNext): Promise<void> {
    let result: SerializedResult | undefined;

    try {
      const output = await next();

      // Set implicit headers
      res.setHeaders(SerializeUtil.convertHeaders(res[WebSymbols.HeadersAdded]) ?? {});

      if (SerializeUtil.isRenderable(output)) {
        result = await SerializeUtil.serializeRenderable(req, res, output);
      } else if (output !== undefined && !res.headersSent) {
        result = SerializeUtil.serializeStandard(output);
      }
    } catch (err) {
      const resolved = err instanceof Error ? err : (
        DataUtil.isPlainObject(err) ?
          new AppError(`${err['message'] || 'Unexpected error'}`, { details: err }) :
          new AppError(`${err}`)
      );

      console.error(resolved.message, { error: resolved });
      result = SerializeUtil.serializeError(resolved);
    }

    if (!result) { // Nothing to do
      return;
    } else if (res.headersSent) { // Already sent, do nothing
      if (Buffer.isBuffer(result)) {
        console.error('Failed to send, already sent data', result.toString('utf8'));
      } else {
        console.error('Failed to send, already sent data');
      }
      return;
    }

    res.setHeaders(result?.headers ?? {});

    // Set header if not defined
    if (result?.defaultContentType && !res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', result.defaultContentType);
    }

    if (!result.data) {
      res.statusCode ??= ((req.method === 'POST' || req.method === 'PUT') ? 201 : 204);
      res.send('');
    } else if (Buffer.isBuffer(result.data) || typeof result.data === 'string') {
      res.send(result);
    } else {
      await res.sendStream(result.data);
    }
  }
}