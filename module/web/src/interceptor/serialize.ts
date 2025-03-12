import { Inject, Injectable } from '@travetto/di';
import { AppError, hasFunction } from '@travetto/runtime';
import { DataUtil } from '@travetto/schema';
import { Config } from '@travetto/config';

import { HttpSerializable } from '../response/serializable';
import { HttpInterceptor, ManagedInterceptorConfig } from './types';
import { FilterContext, FilterNext, HttpPayload, HttpRequest, HttpResponse } from '../types';
import { HttpPayloadUtil } from '../util/payload';
import { WebSymbols } from '../symbols';
import { HttpCompressConfig, HttpCompressionUtil } from '../util/compress';

const isSerializable = hasFunction<HttpSerializable>('serialize');

@Config('web.serialize')
class SerializeConfig extends ManagedInterceptorConfig {
  compress: HttpCompressConfig;
  compressionEnabled = false;
}

/**
 * Serialization interceptor
 */
@Injectable()
export class SerializeInterceptor implements HttpInterceptor<SerializeConfig> {

  @Inject()
  config: SerializeConfig;

  /**
   * Send response
   */
  async sendPayload(req: HttpRequest, res: HttpResponse, basic: HttpPayload): Promise<void> {
    for (const map of [res[WebSymbols.Internal].headersAdded, basic?.headers]) {
      for (const [key, value] of Object.entries(map ?? {})) {
        res.setHeader(key, typeof value === 'function' ? value() : value);
      }
    }

    // Set header if not defined
    if (!res.getHeader('content-type')) {
      res.setHeader('content-type', basic.defaultContentType ?? 'application/octet-stream');
    }

    // Set length if provided
    if (basic.length) {
      res.setHeader('content-length', `${basic.length}`);
    }

    // Set response code if not defined
    if (!basic.statusCode) {
      if (basic.length === 0) {  // On empty response
        basic.statusCode = (req.method === 'POST' || req.method === 'PUT') ? 201 : 204;
      } else {
        basic.statusCode = 200;
      }
    }

    // Stream it
    if (this.config.compressionEnabled && HttpCompressionUtil.shouldCompress(this.config.compress, req, res, basic)) {
      const outputStream = HttpCompressionUtil.getCompressor(this.config.compress, req.header('accept-encoding')?.toString());
      if (outputStream) {
        const original = basic.data;
        basic.data = outputStream;
        res.removeHeader('content-length');

        if (Buffer.isBuffer(original)) {
          outputStream.write(original);
        } else {
          original.pipe(outputStream);
        }
      }
    }

    // Defer to preset status code if already done
    res.statusCode ??= basic.statusCode;

    if (Buffer.isBuffer(basic.data)) {
      res.send(basic);
    } else {
      await res.sendStream(basic.data);
    }
  }

  async intercept({ res, req }: FilterContext, next: FilterNext): Promise<void> {
    let payload: HttpPayload | void;

    try {
      const output = await next();
      payload = isSerializable(output) ? await output.serialize(res) : HttpPayloadUtil.toPayload(output);
    } catch (error) {
      const resolved = error instanceof Error ? error :
        !DataUtil.isPlainObject(error) ? new AppError(`${error}`) :
          new AppError(`${error['message'] || 'Unexpected error'}`, { details: error });

      console.error(resolved.message, { error: resolved });
      payload = HttpPayloadUtil.fromError(resolved);
    }

    if (!payload) {
      return; // Nothing to return
    } else if (res.headersSent) {
      return console.error('Failed to send, response already sent');
    }

    await this.sendPayload(req, res, payload);
  }
}