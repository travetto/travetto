import rawBody from 'raw-body';

import { Injectable, Inject, DependencyRegistry, InjectableFactory } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError, toConcrete } from '@travetto/runtime';

import { WebChainedContext } from '../types.ts';
import { WebResponse } from '../types/response.ts';
import { WebInterceptorCategory } from '../types/core.ts';
import { WebInterceptor, WebInterceptorContext } from '../types/interceptor.ts';

import { WebBodyUtil } from '../util/body.ts';

import { AcceptsInterceptor } from './accepts.ts';
import { DecompressInterceptor } from './decompress.ts';

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
  limit: string = '1mb';
  /**
   * How to interpret different content types
   */
  parsingTypes: Record<string, string> = {
    text: 'text',
    'application/json': 'json',
    'application/x-www-form-urlencoded': 'form'
  };
}

/**
 * Parses the body input content
 */
@Injectable()
export class BodyParseInterceptor implements WebInterceptor<BodyParseConfig> {

  dependsOn = [AcceptsInterceptor, DecompressInterceptor];
  category: WebInterceptorCategory = 'request';
  parsers: Record<string, BodyContentParser> = {
    text: { type: 'text', parse: s => s },
    json: { type: 'json', parse: s => JSON.parse(s) },
    form: { type: 'form', parse: s => Object.fromEntries(new URLSearchParams(s)) }
  };

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
    const stream = WebBodyUtil.getRawStream(request.body);
    const contentType = request.headers.getContentType();
    const parserType = config.parsingTypes[contentType?.full!] ?? config.parsingTypes[contentType?.type!];

    if (stream && contentType && parserType) { // We have a stream, content type and a parser
      try {
        const text = await rawBody(stream, {
          limit: config.limit,
          encoding: contentType.parameters.charset ?? 'utf8'
        });
        request.body = this.parsers[parserType].parse(text);
        return next();
      } catch (err) {
        throw new AppError('Malformed input', { category: 'data', cause: err });
      }
    }

    return next();
  }
}