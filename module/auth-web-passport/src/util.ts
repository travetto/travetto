import { WebFilterContext, WebRequest } from '@travetto/web';
import { castTo, Util } from '@travetto/runtime';

/**
 * Passport utilities
 */
export class PassportUtil {

  /**
   * Read passport state string as bas64 encoded JSON value
   * @param src The input src for a state read (string, or a request)
   */
  static readState<T = Record<string, unknown>>(src?: string | WebRequest): T | undefined {
    const state = (typeof src === 'string' ? src :
      (typeof src?.context.httpQuery?.state === 'string' ?
        src?.context.httpQuery?.state : ''));
    if (state) {
      try {
        return Util.decodeSafeJSON(state);
      } catch { }
    }
  }

  /**
   * Write state value from plain object
   * @param state
   * @returns base64 encoded state value, if state is provided
   */
  static writeState(state?: Record<string, unknown>): string | undefined {
    if (state) {
      return Util.encodeSafeJSON(state);
    }
  }

  /**
   * Add to a given state value
   * @param state The new state data to inject
   * @param currentState The optional, current state/request
   * @param key Optional location to nest new state data
   * @returns
   */
  static addToState(state: string | Record<string, unknown>, current?: string | WebRequest, key?: string): string {
    const pre = this.readState(current) ?? {};
    const toAdd = typeof state === 'string' ? JSON.parse(state) : state;
    const base: Record<string, unknown> = key ? castTo(pre[key] ??= {}) : pre;
    for (const property of Object.keys(toAdd)) {
      if (property === '__proto__' || property === 'constructor' || property === 'prototype') {
        continue;
      }
      base[property] = toAdd[property];
    }
    return this.writeState(pre)!;
  }

  /**
   * Enhance passport state with additional information information
   * @param ctx The travetto filter context
   * @param currentState The current state, if any
   */
  static enhanceState({ request }: WebFilterContext, currentState?: string): string {
    return this.addToState({ referrer: request.headers.get('Referer') }, currentState);
  }
}