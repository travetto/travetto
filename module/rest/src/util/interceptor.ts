import { ControllerConfig } from '../registry/types';
import { Request, RouteConfig } from '../types';

type ContentType = { type: string, subtype: string, full: string, parameters: Record<string, string> };
const ParsedType = Symbol.for('@trv:rest/content-type');

export interface RouteRule {
  sub: string | RegExp;
  base: string;
  positive: boolean;
}

/**
 * Interceptor specific utilities
 */
export class InterceptorUtil {
  /**
   * Clean a list of route patterns into rules
   * @param routePatterns The list of route patterns as strings
   */
  static getRules(routePatterns: string[]): RouteRule[] {
    return routePatterns.map(x => x.split(':')).map(([base, sub]) => {
      let final: string | RegExp = sub || '*';
      const positive = !base.startsWith('!');
      base = base.replace(/^(!|\/)+/, '');
      if (final.includes('*')) {
        final = new RegExp(`^${final.replace(/[*]/g, '.*')}`);
      }
      return { base, sub: final, positive };
    });
  }

  /**
   * Matches a given route against a list of route checks
   */
  static matchRoute(rules: RouteRule[], route: RouteConfig, controller: Partial<ControllerConfig>): boolean {
    if (rules.length) {
      for (const { base, sub, positive } of rules) {
        let match = false;
        if (base === (controller.basePath ?? '').replace(/^\/+/, '') || base === '*') {
          if (!sub || sub === '*') {
            match = true;
          } else if (typeof route.path === 'string') {
            match = (typeof sub === 'string') ? route.path === sub : sub.test(route.path);
          }
        }
        if (match) {
          return positive;
        }
      }
    }
    return true;
  }

  /**
   * Create a predicate function that will check a given route/controller setup against an allow/deny list.
   *   It is intended to be used during controller setup to determine an interceptors inclusion in the exposed endpoint.
   */
  static buildRouteChecker(allowDeny: string[]): (route: RouteConfig, controller: Partial<ControllerConfig>) => boolean {
    return this.matchRoute.bind(this, this.getRules(allowDeny));
  }

  /**
   * Get the fully parsed content type
   */
  static getContentType(req: Request & { [ParsedType]?: ContentType }): ContentType | undefined {
    if (!req[ParsedType]) {
      const text = req.header('content-type');
      if (text) {
        const [full, ...params] = text.split(/\s*;\s*/);
        const [type, subtype] = full.split('/');
        const parameters = Object.fromEntries(params.map(v => v.split('=')).map(([k, v]) => [k.toLowerCase(), v]));
        req[ParsedType] = { type, subtype, full, parameters };
      }
    }
    return req[ParsedType];
  }
}