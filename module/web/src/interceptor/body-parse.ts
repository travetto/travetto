import iconv from 'iconv-lite';

import { Injectable, Inject, DependencyRegistry } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError, toConcrete } from '@travetto/runtime';
import { Ignore } from '@travetto/schema';

import { WebChainedContext } from '../types/filter.ts';
import { WebResponse } from '../types/response.ts';
import { WebInterceptorCategory } from '../types/core.ts';
import { WebInterceptor, WebInterceptorContext } from '../types/interceptor.ts';

import { WebBodyUtil } from '../util/body.ts';
import { WebCommonUtil } from '../util/common.ts';

import { AcceptInterceptor } from './accept.ts';
import { DecompressInterceptor } from './decompress.ts';
import { WebError } from '../types/error.ts';

/**
 * @concrete
 */
export interface BodyContentParser {
  type: string;
  parse: (source: string) => unknown;
};

/**
 * Web body parse configuration
 */
@Config('web.bodyParse')
export class BodyParseConfig {
  /**
   * Parse request body
   */
  applies: boolean = true;
  /**
   * Max body size limit
   */
  limit: `${number}${'mb' | 'kb' | 'gb' | 'b' | ''}` = '1mb';
  /**
   * How to interpret different content types
   */
  parsingTypes: Record<string, string> = {
    text: 'text',
    'application/json': 'json',
    'application/x-www-form-urlencoded': 'form'
  };

  @Ignore()
  _limit: number | undefined;

  postConstruct(): void {
    this._limit = WebCommonUtil.parseByteSize(this.limit);
  }
}


/**
 * Parses the body input content
 */
@Injectable()
export class BodyParseInterceptor implements WebInterceptor<BodyParseConfig> {

  dependsOn = [AcceptInterceptor, DecompressInterceptor];
  category: WebInterceptorCategory = 'request';
  parsers: Record<string, BodyContentParser> = {};

  @Inject()
  config: BodyParseConfig;

  async postConstruct(): Promise<void> {
    // Load all the parser types
    const instances = await DependencyRegistry.getCandidateInstances(toConcrete<BodyContentParser>());
    for (const instance of instances) {
      this.parsers[instance.type] = instance;
    }
  }

  applies({ endpoint, config }: WebInterceptorContext<BodyParseConfig>): boolean {
    return config.applies && endpoint.allowsBody;
  }

  async filter({ request, config, next }: WebChainedContext<BodyParseConfig>): Promise<WebResponse> {
    const contentType = request.headers.getContentType();
    if (!contentType || !WebBodyUtil.isRaw(request.body)) {
      return next();
    }

    const parserType = config.parsingTypes[contentType.full] ?? config.parsingTypes[contentType.type];
    if (parserType) { // We have a stream, content type and a parser
      const input = request.body;
      const lengthRead = +(request.headers.get('Content-Length') || '');
      const length = Number.isNaN(lengthRead) ? undefined : lengthRead;
      const limit = config._limit ?? Number.MAX_SAFE_INTEGER;
      const encoding = contentType.parameters.charset ??
        (Buffer.isBuffer(input) ? undefined : input.readableEncoding) ?? 'utf-8';

      let received = Buffer.isBuffer(input) ? input.byteOffset : 0;

      if (length && length > limit) {
        throw WebError.for('Request Entity Too Large', 413, { length, limit });
      } else if (!iconv.encodingExists(encoding)) {
        throw WebError.for('Specified Encoding Not Supported', 415, { encoding });
      }

      let text: string;
      if (Buffer.isBuffer(input)) {
        text = iconv.decode(input, encoding);
      } else {
        const decoder = iconv.getDecoder(encoding);
        const all: string[] = [];
        try {
          for await (const chunk of input.iterator({ destroyOnReturn: false })) {
            received += Buffer.isBuffer(chunk) ? chunk.byteLength : (typeof chunk === 'string' ? chunk.length : chunk.length);
            if (received > limit) {
              throw WebError.for('Request Entity Too Large', 413, { received, limit });
            }
            all.push(decoder.write(chunk));
          }
          all.push(decoder.end() ?? '');
          text = all.join('');
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            throw WebError.for('Request Aborted', 400, { length, received });
          } else {
            throw err;
          }
        }
      }

      if (length && text.length !== length) {
        throw WebError.for('Request Size Did Not Match Content Length', 400, { length, received });
      }

      try {
        request.body = parserType in this.parsers ?
          this.parsers[parserType].parse(text) :
          WebBodyUtil.parseBody(parserType, text);

        return next();
      } catch (err) {
        throw new AppError('Malformed input', { category: 'data', cause: err });
      }
    }

    return next();
  }
}