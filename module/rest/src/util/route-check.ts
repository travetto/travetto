import { Util } from '@travetto/base';

import { RouteApplies } from '../interceptor/types';
import { ControllerConfig } from '../registry/types';
import { RouteConfig } from '../types';

interface RouteRule {
  sub: string | RegExp;
  base: string;
}

/**
 * Interceptor specific utilities
 */
export class RouteCheckUtil {
  static #convertRule(rule: string): RouteRule {
    const [base, sub] = rule.split(':');
    let final: string | RegExp = (sub || '*').replace(/^\/+/, '');
    if (final.includes('*')) {
      final = new RegExp(`^${final.replace(/[*]/g, '.*')}`);
    }
    return { base: base.replace(/^\/+/, ''), sub: final };
  }

  static #compareRule({ sub, base }: RouteRule, route: RouteConfig, controller?: ControllerConfig): boolean {
    console.log('Comparing rule', { base, sub }, { base: controller?.basePath, sub: route.path });
    let match = false;
    if (base === (controller?.basePath ?? '').replace(/^\/+/, '') || base === '*') {
      if (!sub || sub === '*') {
        match = true;
      } else if (typeof route.path === 'string') {
        match = (typeof sub === 'string') ? route.path.replace(/^\/+/, '') === sub : sub.test(route.path);
      }
    }
    return match;
  }

  /**
   * Create a predicate function that will check a given route/controller setup against an allow/deny list.
   *   It is intended to be used during controller setup to determine an interceptors inclusion in the exposed endpoint.
   */
  static matcher(allowDeny: string[]): RouteApplies {
    return Util.allowDenyMatcher<RouteRule, Parameters<RouteApplies>>(
      allowDeny,
      this.#convertRule.bind(this),
      this.#compareRule.bind(this),
    );
  }
}