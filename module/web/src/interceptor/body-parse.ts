import inflation from 'inflation';
import rawBody from 'raw-body';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError } from '@travetto/runtime';

import { HttpRequest, HttpContext, HttpFilterNext, WebInternal } from '../types.ts';
import { EndpointConfig } from '../registry/types.ts';

import { ManagedInterceptorConfig, HttpInterceptor, HttpInterceptorCategory, HttpInterceptorContext } from './types.ts';
import { AcceptsInterceptor } from './accepts.ts';

const METHODS_WITH_BODIES = new Set(['post', 'put', 'patch', 'PUT', 'POST', 'PATCH']);

type ParserType = 'json' | 'text' | 'form';

/**
 * Web body parse configuration
 */
@Config('web.bodyParse')
export class BodyParseConfig extends ManagedInterceptorConfig {
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

  async read(req: HttpRequest, limit: string | number): Promise<{ text: string, raw: Buffer }> {
    const cfg = req.getContentType();

    const text = await rawBody(inflation(req[WebInternal].nodeEntity), {
      limit,
      encoding: cfg?.parameters.charset ?? 'utf8'
    });
    return { text, raw: Buffer.from(text) };
  }

  detectParserType(req: HttpRequest, parsingTypes: Record<string, ParserType>): ParserType | undefined {
    const { full = '' } = req.getContentType() ?? {};
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

  applies(endpoint: EndpointConfig): boolean {
    return endpoint.method === 'all' || METHODS_WITH_BODIES.has(endpoint.method);
  }

  async intercept({ req, config }: HttpInterceptorContext<BodyParseConfig>, next: HttpFilterNext): Promise<unknown> {
    if (!METHODS_WITH_BODIES.has(req.method) || req.body) { // If body is already set
      return next();
    }

    const parserType = this.detectParserType(req, config.parsingTypes);

    if (!parserType) {
      req.body = req[WebInternal].nodeEntity;
      return next();
    } else {
      let malformed: unknown;
      try {
        const { text, raw } = await this.read(req, config.limit);
        req.raw = raw;
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