import { Inject, Injectable } from '@travetto/di';
import { AppError, hasFunction } from '@travetto/runtime';
import { DataUtil } from '@travetto/schema';
import { Config } from '@travetto/config';

import { HttpSerializable } from '../response/serializable';
import { HttpInterceptor, ManagedInterceptorConfig } from './types';
import { FilterContext, FilterNext, HttpPayload, HttpRequest, HttpResponse } from '../types';
import { HttpPayloadUtil } from '../util/payload';
import { WebSymbols } from '../symbols';
import { HttpCompressionUtil, HttpCompressEncoding, HttpCompressOptions } from '../util/compress';

const isSerializable = hasFunction<HttpSerializable>('serialize');

@Config('web.serialize')
class SerializeConfig extends ManagedInterceptorConfig {
  compress = true;
  compressEncodings: HttpCompressEncoding[] = ['br', 'gzip', 'deflate', 'identity'];
  compressEncodingsPreferred: HttpCompressEncoding[] = ['br', 'gzip'];
  compressOptions: HttpCompressOptions = {};
  errorStackTrace = true;
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

    // Defer to preset status code if already done
    res.statusCode = basic.statusCode;

    const compressor = this.config.compress ? HttpCompressionUtil.getCompressor(
      req, res, this.config.compressOptions, this.config.compressEncodings, this.config.compressEncodingsPreferred
    ) : undefined;

    // If we are compressing
    if (compressor?.stream) {
      res.removeHeader('content-length');
      res.setHeader('content-encoding', compressor.type);

      if (Buffer.isBuffer(basic.data)) {
        compressor.stream.end(basic.data);
      } else {
        basic.data.pipe(compressor.stream);
      }
      await res.sendStream(compressor.stream);
    } else if (Buffer.isBuffer(basic.data)) {
      res.end(basic.data);
    } else {
      await res.sendStream(basic.data);
    }
  }

  async intercept({ res, req }: FilterContext, next: FilterNext): Promise<void> {
    if (this.config.compress) {
      res.setHeader('Vary', 'Accept-Encoding');
    }

    try {
      const output = await next();
      const payload = isSerializable(output) ? await output.serialize(res) : HttpPayloadUtil.toPayload(output);

      if (!payload) {
        return; // Nothing to return
      } else if (res.headersSent) {
        return console.error('Failed to send, response already sent');
      }
      await this.sendPayload(req, res, payload);
    } catch (error) {
      const resolved = error instanceof Error ? error :
        !DataUtil.isPlainObject(error) ? new AppError(`${error}`) :
          new AppError(`${error['message'] || 'Unexpected error'}`, { details: error });

      if (this.config.errorStackTrace) {
        console.error(resolved.message, { error: resolved });
      }
      await this.sendPayload(req, res, HttpPayloadUtil.fromError(resolved));
    }
  }
}