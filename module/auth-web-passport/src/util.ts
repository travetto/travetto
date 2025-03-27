import { HttpRequest } from '@travetto/web';
import { castTo, Util } from '@travetto/runtime';

/**
 * Passport utilities
 */
export class PassportUtil {

  /**
   * Read passport state string as bas64 encoded JSON value
   * @param src The input src for a state read (string, or a request obj)
   */
  static readState<T = Record<string, unknown>>(src?: string | HttpRequest): T | undefined {
    const state = (typeof src === 'string' ? src : (typeof src?.query.state === 'string' ? src?.query.state : ''));
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
  static addToState(state: string | Record<string, unknown>, current?: string | HttpRequest, key?: string): string {
    const pre = this.readState(current) ?? {};
    const toAdd = typeof state === 'string' ? JSON.parse(state) : state;
    const base: Record<string, unknown> = key ? castTo(pre[key] ??= {}) : pre;
    for (const k of Object.keys(toAdd)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
        continue;
      }
      base[k] = toAdd[k];
    }
    return this.writeState(pre)!;
  }

  /**
   * Enhance passport state with additional information information
   * @param req The travetto request,
   * @param currentState The current state, if any
   */
  static enhanceState(req: HttpRequest, currentState?: string): string {
    return this.addToState({ referrer: req.getHeader('referer') }, currentState);
  }
}