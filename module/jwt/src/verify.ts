import * as jws from 'jws';

import { JWTError } from './error';
import { VerifyOptions, Payload, AlgType } from './types';

const RSA: AlgType[] = ['RS256', 'RS384', 'RS512'];
const ES: AlgType[] = ['ES256', 'ES384', 'ES512'];
const HS: AlgType[] = ['HS256', 'HS384', 'HS512'];

const toArr = <T>(v: T | T[]) => Array.isArray(v) ? v : [v];

export class JWTVerifier {

  /**
   * Verify signature types
   */
  static verifyTypes(o: unknown) {
    const p = o as Payload;

    for (const [t, f] of [
      ['string', ['iss', 'sub', 'jti', 'kid']],
      ['number', ['iat', 'nbf', 'exp']]
    ]) {
      for (const k of f) {
        if (k in p && typeof p[k] !== t) {
          throw new JWTError(`invalid payload claim, "${k}" should be of type ${t}, but was ${typeof p[k]}`);
        }
      }
    }
    if ('aud' in p && !((typeof p.aud === 'string') || Array.isArray(p.aud))) {
      throw new JWTError(`invalid payload claim, "aud" should be of type string|string[], but was ${typeof p.aud}`);
    }
    return o;
  }

  /**
   * Verify payload time properties
   */
  static verifyTimes(payload: Payload, options: VerifyOptions) {
    const oct = options.clock?.timestamp;
    const octn = typeof oct === 'number' ? oct : Math.trunc((oct ?? new Date()).getTime() / 1000);

    const clock = {
      tolerance: 0,
      ...(options.clock ?? {}),
      timestamp: octn,
    };

    const ignore = {
      exp: false,
      nbf: false,
      ...options.ignore ?? {}
    };


    if (payload.nbf !== undefined && !ignore.nbf &&
      payload.nbf > clock.timestamp + clock.tolerance
    ) {
      throw new JWTError('Token is not active', { date: new Date(payload.nbf * 1000) }, 'permissions');
    }

    if (payload.exp !== undefined && !ignore.exp &&
      clock.timestamp >= payload.exp + clock.tolerance
    ) {
      throw new JWTError('Token is expired', { expiredAt: new Date(payload.exp * 1000) }, 'permissions');
    }

    if (options.maxAgeSec) {
      if (payload.iat === undefined) {
        throw new JWTError('iat required when maxAge is specified');
      }

      const maxAgeTimestamp = options.maxAgeSec + payload.iat;

      if (clock.timestamp >= maxAgeTimestamp + (clock.tolerance || 0)) {
        throw new JWTError('Token maxAge exceeded', { date: new Date(maxAgeTimestamp * 1000) });
      }
    }
  }

  /**
   * Verify contextual data
   */
  static verifyContext(payload: Payload, options: VerifyOptions) {
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
  static verifyHeader(header: jws.Header, signature: string, key: string | Buffer | undefined, options: VerifyOptions) {
    // clone this object since we are going to mutate it.
    const headerVerify = { ...(options.header ?? {}), alg: undefined! as (string | string[]), typ: 'JWT' };

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