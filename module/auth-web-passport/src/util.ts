import type { WebFilterContext, WebRequest } from '@travetto/web';
import { castTo, JSONUtil } from '@travetto/runtime';

/**
 * Passport utilities
 */
export class PassportUtil {

  /**
   * Read passport state string as bas64 encoded JSON value
   * @param input The input for a state read (string, or a request)
   */
  static readState<T = Record<string, unknown>>(input?: string | WebRequest): T | undefined {
    const state = (typeof input === 'string' ? input :
      (typeof input?.context.httpQuery?.state === 'string' ?
        input?.context.httpQuery?.state : ''));
    if (state) {
      try {
        return JSONUtil.fromBase64(state);
      } catch { }
    }
  }

  /**
   * Write state value from plain object
   * @param state
   * @returns base64 encoded state value, if state is provided
   */
  static writeState(state?: Record<string, unknown>): string | undefined {
    return state ? JSONUtil.toBase64(state) : undefined;
  }

  /**
   * Add to a given state value
   * @param state The new state data to inject
   * @param currentState The optional, current state/request
   * @param key Optional location to nest new state data
   * @returns
   */
  static addToState(state: string | Record<string, unknown>, current?: string | WebRequest, key?: string): string {
    const original = this.readState(current) ?? {};
    const toAdd: Record<string, unknown> = typeof state === 'string' ? JSONUtil.fromUTF8(state) : state;
    const base: Record<string, unknown> = key ? castTo(original[key] ??= {}) : original;
    for (const property of Object.keys(toAdd)) {
      if (property === '__proto__' || property === 'constructor' || property === 'prototype') {
        continue;
      }
      base[property] = toAdd[property];
    }
    return this.writeState(original)!;
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