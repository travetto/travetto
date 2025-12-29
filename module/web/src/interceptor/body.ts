import { Injectable, Inject, DependencyRegistryIndex } from '@travetto/di';
import { Config } from '@travetto/config';
import { toConcrete } from '@travetto/runtime';
import { Ignore } from '@travetto/schema';

import { WebChainedContext } from '../types/filter.ts';
import { WebResponse } from '../types/response.ts';
import { WebInterceptorCategory } from '../types/core.ts';
import { WebInterceptor, WebInterceptorContext } from '../types/interceptor.ts';

import { WebBodyUtil } from '../util/body.ts';
import { ByteSizeInput, WebCommonUtil } from '../util/common.ts';

import { AcceptInterceptor } from './accept.ts';
import { DecompressInterceptor } from './decompress.ts';
import { WebError } from '../types/error.ts';
import { WebHeaderUtil } from '../util/header.ts';

/**
 * @concrete
 */
export interface BodyContentParser {
  type: string;
  parse: (source: string) => unknown;
};

/**
 * Web body  configuration
 */
@Config('web.body')
export class WebBodyConfig {
  /**
   * Parse request body
   */
  applies: boolean = true;
  /**
   * Max body size limit
   */
  limit: ByteSizeInput = '1mb';
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
}

/**
 * Verifies content length, decodes character encodings, and parses body input string via the content type
 */
@Injectable()
export class BodyInterceptor implements WebInterceptor<WebBodyConfig> {

  dependsOn = [AcceptInterceptor, DecompressInterceptor];
  category: WebInterceptorCategory = 'request';
  parsers: Record<string, BodyContentParser> = {};

  @Inject()
  config: WebBodyConfig;

  async postConstruct(): Promise<void> {
    // Load all the parser types
    const instances = await DependencyRegistryIndex.getInstances(toConcrete<BodyContentParser>());
    for (const instance of instances) {
      this.parsers[instance.type] = instance;
    }
  }

  applies({ endpoint, config }: WebInterceptorContext<WebBodyConfig>): boolean {
    return config.applies && endpoint.allowsBody;
  }

  async filter({ request, config, next }: WebChainedContext<WebBodyConfig>): Promise<WebResponse> {
    const input = request.body;

    if (!WebBodyUtil.isRaw(input)) {
      return next();
    }

    const lengthRead = +(request.headers.get('Content-Length') || '');
    const length = Number.isNaN(lengthRead) ? undefined : lengthRead;
    const limit = config._limit ??= WebCommonUtil.parseByteSize(config.limit);

    if (length && length > limit) {
      throw WebError.for('Request entity too large', 413, { length, limit });
    }

    const contentType = WebHeaderUtil.parseHeaderSegment(request.headers.get('Content-Type'));
    if (!contentType.value) {
      return next();
    }

    const [baseMimeType,] = contentType.value.split('/');
    const parserType = config.parsingTypes[contentType.value] ?? config.parsingTypes[baseMimeType];
    if (!parserType) {
      return next();
    }

    const { text, read } = await WebBodyUtil.readText(input, limit, contentType.parameters.charset);

    if (length && read !== length) {
      throw WebError.for('Request size did not match Content-Length', 400, { length, read });
    }

    try {
      request.body = parserType in this.parsers ?
        this.parsers[parserType].parse(text) :
        WebBodyUtil.parseBody(parserType, text);

      return next();
    } catch (error) {
      throw WebError.for('Malformed input', 400, { cause: error });
    }
  }
}