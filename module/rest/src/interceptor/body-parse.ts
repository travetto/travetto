import inflation from 'inflation';
import rawBody from 'raw-body';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError } from '@travetto/runtime';

import { NodeEntitySymbol } from '../internal/symbol';
import { RouteConfig, Request, FilterContext, FilterNext } from '../types';

import { ManagedInterceptorConfig, RestInterceptor } from './types';
import { SerializeInterceptor } from './serialize';
import { AcceptsInterceptor } from './accepts';

const METHODS_WITH_BODIES = new Set(['post', 'put', 'patch', 'PUT', 'POST', 'PATCH']);

type ParserType = 'json' | 'text' | 'form';

/**
 * Rest body parse configuration
 */
@Config('rest.bodyParse')
export class RestBodyParseConfig extends ManagedInterceptorConfig {
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
export class BodyParseInterceptor implements RestInterceptor<RestBodyParseConfig> {

  dependsOn = [SerializeInterceptor, AcceptsInterceptor];

  @Inject()
  config: RestBodyParseConfig;

  async read(req: Request, limit: string | number): Promise<{ text: string, raw: Buffer }> {
    const cfg = req.getContentType();

    const text = await rawBody(inflation(req[NodeEntitySymbol]), {
      limit,
      encoding: cfg?.parameters.charset ?? 'utf8'
    });
    return { text, raw: Buffer.from(text) };
  }

  detectParserType(req: Request, parsingTypes: Record<string, ParserType>): ParserType | undefined {
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

  applies(route: RouteConfig): boolean {
    return route.method === 'all' || METHODS_WITH_BODIES.has(route.method);
  }

  async intercept({ req, res, config }: FilterContext<RestBodyParseConfig>, next: FilterNext): Promise<unknown> {
    if (!METHODS_WITH_BODIES.has(req.method) || req.body) { // If body is already set
      return next();
    }

    const parserType = this.detectParserType(req, config.parsingTypes);

    if (!parserType) {
      req.body = req[NodeEntitySymbol];
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