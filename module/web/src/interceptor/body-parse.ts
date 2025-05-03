import { Injectable, Inject, DependencyRegistry } from '@travetto/di';
import { Config } from '@travetto/config';
import { toConcrete } from '@travetto/runtime';
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
    const input = request.body;

    if (!WebBodyUtil.isRaw(input)) {
      return next();
    }

    const lengthRead = +(request.headers.get('Content-Length') || '');
    const length = Number.isNaN(lengthRead) ? undefined : lengthRead;

    const limit = config._limit ?? Number.MAX_SAFE_INTEGER;
    if (length && length > limit) {
      throw WebError.for('Request entity too large', 413, { length, limit });
    }

    const contentType = request.headers.getContentType();
    if (!contentType) {
      return next();
    }

    const parserType = config.parsingTypes[contentType.full] ?? config.parsingTypes[contentType.type];
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
    } catch (err) {
      throw WebError.for('Malformed input', 400, { cause: err });
    }
  }
}