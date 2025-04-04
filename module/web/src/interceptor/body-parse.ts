import inflation from 'inflation';
import rawBody from 'raw-body';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError } from '@travetto/runtime';

import { HttpChainedContext } from '../types.ts';
import { HttpResponse } from '../types/response.ts';
import { HttpRequest } from '../types/request.ts';
import { HttpInterceptorCategory, HTTP_METHODS } from '../types/core.ts';
import { HttpInterceptor } from '../types/interceptor.ts';

import { EndpointConfig } from '../registry/types.ts';

import { AcceptsInterceptor } from './accepts.ts';

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
export class BodyParseInterceptor implements HttpInterceptor<BodyParseConfig> {

  dependsOn = [AcceptsInterceptor];
  category: HttpInterceptorCategory = 'request';

  @Inject()
  config: BodyParseConfig;

  async read(req: HttpRequest, limit: string | number): Promise<string> {
    const cfg = req.headers.getContentType();

    const text = await rawBody(inflation(req.inputStream!), {
      limit,
      encoding: cfg?.parameters.charset ?? 'utf8'
    });
    return text;
  }

  detectParserType(req: HttpRequest, parsingTypes: Record<string, ParserType>): ParserType | undefined {
    const { full = '' } = req.headers.getContentType() ?? {};
    if (!full) {
      return;
    } else if (full in parsingTypes) {
      return parsingTypes[full];
    } else if (/\bjson\b/.test(full)) {
      return 'json';
    } else if (full === 'application/x-www-form-urlencoded') {
      return 'form';
    } else if (/^text\//.test(full)) {
      return 'text';
    }
  }

  parse(text: string, type: ParserType): string | Record<string, string> {
    switch (type) {
      case 'json': return JSON.parse(text);
      case 'text': return text;
      case 'form': return Object.fromEntries(new URLSearchParams(text));
    }
  }

  applies(endpoint: EndpointConfig, config: BodyParseConfig): boolean {
    return config.applies && HTTP_METHODS[endpoint.method].body;
  }

  async filter({ req, config, next }: HttpChainedContext<BodyParseConfig>): Promise<HttpResponse> {
    if (!HTTP_METHODS[req.method].body || req.body !== undefined) { // If body is already set
      return next();
    }

    const parserType = this.detectParserType(req, config.parsingTypes);

    if (!parserType) {
      req.body = req.inputStream;
      return next();
    } else {
      let malformed: unknown;
      try {
        const text = await this.read(req, config.limit);
        req.body = this.parse(text, parserType);
      } catch (err) {
        malformed = err;
      }

      if (!malformed) {
        return next();
      } else {
        console.error('Malformed input', malformed);
        throw new AppError('Malformed input', { category: 'data' });
      }
    }
  }
}