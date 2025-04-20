import { Readable } from 'node:stream';

import rawBody from 'raw-body';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError, Primitive } from '@travetto/runtime';

import { WebChainedContext } from '../types.ts';
import { WebResponse } from '../types/response.ts';
import { WebRequest } from '../types/request.ts';
import { WebInterceptorCategory, HTTP_METHODS } from '../types/core.ts';
import { WebInterceptor } from '../types/interceptor.ts';

import { EndpointConfig } from '../registry/types.ts';
import { WebBodyUtil } from '../util/body.ts';

import { AcceptsInterceptor } from './accepts.ts';
import { DecompressInterceptor } from './decompress.ts';

type ParserType = 'json' | 'text' | 'form';

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
  parsingTypes: Record<string, ParserType> = {};
}

/**
 * Parses the body input content
 */
@Injectable()
export class BodyParseInterceptor implements WebInterceptor<BodyParseConfig> {

  dependsOn = [AcceptsInterceptor, DecompressInterceptor];
  category: WebInterceptorCategory = 'request';

  @Inject()
  config: BodyParseConfig;

  async read(req: WebRequest, body: Readable, limit: string | number): Promise<string> {
    const cfg = req.headers.getContentType();
    const encoding = cfg?.parameters.charset ?? 'utf8';
    return rawBody(body, { limit, encoding });
  }

  detectParserType(req: WebRequest, parsingTypes: Record<string, ParserType>): ParserType | undefined {
    const { full = '', type } = req.headers.getContentType() ?? {};
    if (!full) {
      return;
    } else if (full in parsingTypes) {
      return parsingTypes[full];
    } else if (/\bjson\b/.test(full)) {
      return 'json';
    } else if (full === 'application/x-www-form-urlencoded') {
      return 'form';
    } else if (type === 'text') {
      return 'text';
    }
  }

  parse(text: string, type: ParserType): Primitive | Record<string, string> | Object | unknown[] {
    switch (type) {
      case 'json': return JSON.parse(text);
      case 'text': return text;
      case 'form': return Object.fromEntries(new URLSearchParams(text));
    }
  }

  applies(endpoint: EndpointConfig, config: BodyParseConfig): boolean {
    return config.applies && endpoint.allowsBody;
  }

  async filter({ req, config, next }: WebChainedContext<BodyParseConfig>): Promise<WebResponse> {
    const stream = WebBodyUtil.getRawStream(req.body);
    if (!stream) { // No body to process
      return next();
    }

    const parserType = this.detectParserType(req, config.parsingTypes);
    if (!parserType) {
      return next();
    }

    try {
      const text = await this.read(req, stream, config.limit);
      req.body = this.parse(text, parserType);
      return next();
    } catch (err) {
      throw new AppError('Malformed input', { category: 'data', cause: err });
    }
  }
}