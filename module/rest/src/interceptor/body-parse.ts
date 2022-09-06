import * as inflation from 'inflation';
import * as rawBody from 'raw-body';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { NodeEntityⲐ } from '../internal/symbol';
import { InterceptorUtil } from '../util/interceptor';
import { RouteConfig, Request, Response } from '../types';

import { RestInterceptor } from './types';
import { LoggingInterceptor } from './logging';
import { ManagedConfig, ManagedInterceptor } from './decorator';

const METHODS_WITH_BODIES = new Set(['post', 'put', 'patch', 'PUT', 'POST', 'PATCH']);

type ParserType = 'json' | 'text' | 'form';

/**
 * Rest body parse configuration
 */
@Config('rest.bodyParse')
export class RestBodyParseConfig extends ManagedConfig {
  /**
   * Max body size limit
   */
  limit: string = '100kb';
  /**
   * Limits per route
   */
  routeLimits: Record<string, string> = {};
  /**
   * How to interpret different content types
   */
  parsingTypes: Record<string, ParserType> = {};
}

/**
 * Parses the body input content
 */
@Injectable()
@ManagedInterceptor()
export class BodyParseInterceptor implements RestInterceptor {

  before = [LoggingInterceptor];

  @Inject()
  config: RestBodyParseConfig;

  async read(req: Request): Promise<{ text: string, raw: Buffer }> {
    const cfg = InterceptorUtil.getContentType(req);

    const text = await rawBody(inflation(req[NodeEntityⲐ]), {
      limit: this.config.routeLimits[req.path] ?? this.config.limit,
      encoding: cfg?.parameters.charset ?? 'utf8'
    });
    return { text, raw: Buffer.from(text) };
  }

  detectParserType(req: Request): ParserType | undefined {
    const full = InterceptorUtil.getContentType(req)?.full ?? '';
    if (!full) {
      return;
    } else if (full in this.config.parsingTypes) {
      return this.config.parsingTypes[full];
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

  async intercept(req: Request, res: Response): Promise<unknown> {
    if (!METHODS_WITH_BODIES.has(req.method) || req.body) { // If body is already set
      return;
    }

    const parserType = this.detectParserType(req);

    if (!parserType) {
      req.body = req[NodeEntityⲐ];
    } else {
      const { text, raw } = await this.read(req);
      req.raw = raw;
      req.body = this.parse(text, parserType);
    }
  }
}