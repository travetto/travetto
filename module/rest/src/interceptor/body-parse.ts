import * as inflation from 'inflation';
import * as rawBody from 'raw-body';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { RouteConfig, Request, Response } from '../types';
import { RestInterceptor } from './types';
import { LoggingInterceptor } from './logging';

import { NodeEntityⲐ } from '../internal/symbol';

const METHODS_WITH_BODIES = new Set(['post', 'put', 'patch', 'PUT', 'POST', 'PATCH']);

type ParserType = 'json' | 'text' | 'form';

/**
 * Rest body parse configuration
 */
@Config('rest.bodyParse')
export class RestBodyParseConfig {
  limit: string = '100kb';
  routeLimits: Record<string, string> = {};
  parsingTypes: Record<string, ParserType> = {};
  ignoreRoutes: string[] = [];
}

/**
 * Parses the body input content
 */
@Injectable()
export class BodyParseInterceptor implements RestInterceptor {

  before = [LoggingInterceptor];

  @Inject()
  config: RestBodyParseConfig;

  applies(route: RouteConfig): boolean {
    return (route.method === 'all' || METHODS_WITH_BODIES.has(route.method)) &&
      !(typeof route.path === 'string' && this.config.ignoreRoutes.includes(route.path));
  }

  async read(req: Request): Promise<{ text: string, raw: Buffer }> {
    const [_, ...overrides] = req.header('content-type')?.split(/\s*;\s*/) ?? [];
    const options = Object.fromEntries(overrides.map(v => v.split('=')).map(([k, v]) => [k.toLowerCase(), v]));

    const text = await rawBody(inflation(req[NodeEntityⲐ]), {
      limit: this.config.routeLimits[req.path] ?? this.config.limit,
      encoding: options.charset ?? 'utf8'
    });
    return { text, raw: Buffer.from(text) };
  }

  detectParserType(req: Request): ParserType | undefined {
    const simpleType = req.header('content-type')?.split(/\s*;\s*/)[0];
    if (!simpleType) {
      return;
    } else if (simpleType in this.config.parsingTypes) {
      return this.config.parsingTypes[simpleType];
    } else if (/\bjson\b/.test(simpleType)) {
      return 'json';
    } else if (simpleType === 'application/x-www-form-urlencoded') {
      return 'form';
    } else if (/^text\//.test(simpleType)) {
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