import type jws from 'jws';

import { TimeUtil } from '@travetto/runtime';

import { JWTError } from './error';
import { VerifyOptions, Payload, AlgType, KeyItem } from './types';

const RSA: AlgType[] = ['RS256', 'RS384', 'RS512'];
const ES: AlgType[] = ['ES256', 'ES384', 'ES512'];
const HS: AlgType[] = ['HS256', 'HS384', 'HS512'];

const toArr = <T>(v: T | T[]): T[] => Array.isArray(v) ? v : [v];

export class JWTVerifier {

  /**
   * Verify signature types
   */
  static verifyTypes<T extends Payload = Payload>(o: T): T {
    for (const [t, f] of [
      ['string', ['iss', 'sub', 'jti', 'kid']],
      ['number', ['iat', 'nbf', 'exp']]
    ]) {
      for (const k of f) {
        if (k in o && typeof o[k] !== t) {
          throw new JWTError(`invalid payload claim, "${k}" should be of type ${t}, but was ${typeof o[k]}`);
        }
      }
    }
    if ('aud' in o && !((typeof o.aud === 'string') || Array.isArray(o.aud))) {
      throw new JWTError(`invalid payload claim, "aud" should be of type string|string[], but was ${typeof o.aud}`);
    }
    return o;
  }

  /**
   * Verify payload time properties
   */
  static verifyTimes(payload: Payload, options: VerifyOptions): void {
    const timestamp = options.clock?.timestamp;
    const timestampSeconds = typeof timestamp === 'number' ? timestamp : TimeUtil.asSeconds(timestamp ?? new Date());

    const clock = {
      tolerance: 0,
      ...(options.clock ?? {}),
      timestamp: timestampSeconds,
    };

    const ignore = {
      exp: false,
      nbf: false,
      ...options.ignore ?? {}
    };

    if (payload.nbf !== undefined && !ignore.nbf &&
      payload.nbf > clock.timestamp + clock.tolerance
    ) {
      throw new JWTError('Token is not active', { details: { date: TimeUtil.asDate(payload.nbf, 's') }, category: 'permissions' });
    }

    if (payload.exp !== undefined && !ignore.exp &&
      clock.timestamp >= payload.exp + clock.tolerance
    ) {
      throw new JWTError('Token is expired', { details: { expiredAt: TimeUtil.asDate(payload.exp, 's') }, category: 'permissions' });
    }

    if (options.maxAgeSec) {
      if (payload.iat === undefined) {
        throw new JWTError('iat required when maxAge is specified');
      }

      const maxAgeTimestamp = options.maxAgeSec + payload.iat;

      if (clock.timestamp >= maxAgeTimestamp + (clock.tolerance || 0)) {
        throw new JWTError('Token maxAge exceeded', { details: { date: TimeUtil.asDate(maxAgeTimestamp, 's') } });
      }
    }
  }

  /**
   * Verify contextual data
   */
  static verifyContext(payload: Payload, options: VerifyOptions): void {
    const verifyPayload = { ...(options.payload ?? {}) };

    if (verifyPayload.aud) {
      const aud = toArr(verifyPayload.aud);
      const target = toArr(payload.aud ?? '');

      const match = target.some((targetAudience) =>
        aud.some(x => x instanceof RegExp ? x.test(targetAudience) : x === targetAudience)
      );

      if (!match) {
        throw new JWTError(`Token audience is invalid. expected: ${aud.join(' or ')}`);
      }
    }

    if (verifyPayload.iss) {
      const invalid = !toArr(verifyPayload.iss).includes(payload.iss!);

      if (invalid) {
        throw new JWTError(`Token issuer is invalid. expected: ${verifyPayload.iss}`);
      }
    }

    if (verifyPayload.sub && payload.sub !== verifyPayload.sub) {
      throw new JWTError(`Token subject is invalid. expected: ${verifyPayload.sub}`);
    }

    if (verifyPayload.jti && payload.jti !== verifyPayload.jti) {
      throw new JWTError(`Token id is invalid. expected: ${verifyPayload.jti}`);
    }
  }

  /**
   * Verify header and signature
   */
  static verifyHeader(header: jws.Header, signature: string, key: KeyItem | undefined, options: VerifyOptions): void {
    // clone this object since we are going to mutate it.
    const headerVerify: { typ: 'JWT', alg?: jws.Algorithm | jws.Algorithm[] } = { ...(options.header ?? {}), typ: 'JWT' };

    if (header.typ && header.typ !== 'JWT') {
      throw new JWTError('Token is not a valid JWT');
    }

    if (signature) {
      if (!key) {
        throw new JWTError('secret or public key must be provided');
      }
    } else if (key) {
      throw new JWTError('signature is required');
    }

    if (!headerVerify.alg && key) {
      const keyStr = key.toString();
      headerVerify.alg = /BEGIN (CERTIFICATE|PUBLIC KEY)/.test(keyStr) ? RSA.concat(ES) :
        /BEGIN RSA PUBLIC KEY/.test(keyStr) ? RSA : HS;
    }

    if (headerVerify.alg) {
      if (!toArr(headerVerify.alg).includes(header.alg)) {
        throw new JWTError('invalid algorithm');
      }
    }
  }
}