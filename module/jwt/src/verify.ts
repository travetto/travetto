import * as jws from 'jws';

import { JWTError } from './common';
import { decodeComplete } from './decode';
import { VerifyOptions, Payload, AlgType } from './types';

const RSA: AlgType[] = ['RS256', 'RS384', 'RS512'];
const ES: AlgType[] = ['ES256', 'ES384', 'ES512'];
const HS: AlgType[] = ['HS256', 'HS384', 'HS512'];

function verifyTypes(o: any): o is Payload {
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

export async function verify(jwt: string, options: VerifyOptions = {}) {

  // clone this object since we are going to mutate it.
  const headerVerify = { ...(options.header || {}), alg: undefined as any as (string | string[]), typ: 'JWT' };
  const verifyPayload = { ...(options.payload || {}) };

  const oct = (options.clock && options.clock.timestamp);
  const octn = oct instanceof Date ? oct.getTime() : (typeof oct === 'number' ? oct : Date.now());

  const clock = {
    tolerance: 0,
    ...(options.clock || {}),
    timestamp: Math.trunc(octn / 1000),
  };

  const ignore = {
    exp: false,
    nbf: false,
    ...options.ignore || {}
  };

  const { header, signature, payload } = decodeComplete<Payload>(jwt);

  if (header.typ && header.typ !== 'JWT') {
    throw new JWTError('Token is not a valid JWT');
  }

  let key: string | Buffer | undefined;

  if (options.key) {
    key = await options.key;
  }

  if (signature) {
    if (!key) {
      throw new JWTError('secret or public key must be provided');
    }
  } else {
    if (key) {
      throw new JWTError('signature is required');
    }
  }

  if (!headerVerify.alg && key) {
    const keyStr = key.toString();
    headerVerify.alg = /BEGIN (CERTIFICATE|PUBLIC KEY)/.test(keyStr) ? RSA.concat(ES) :
      /BEGIN RSA PUBLIC KEY/.test(keyStr) ? RSA : HS;
  }

  if (headerVerify.alg) {
    const algs = Array.isArray(headerVerify.alg) ? headerVerify.alg : [headerVerify.alg];

    if (!algs.includes(header.alg)) {
      throw new JWTError('invalid algorithm');
    }
  }

  const valid = jws.verify(jwt, header.alg, key || '');

  if (!valid) {
    throw new JWTError('invalid signature');
  }

  verifyTypes(payload);

  if (payload.nbf !== undefined && !ignore.nbf &&
    payload.nbf > clock.timestamp + clock.tolerance
  ) {
    throw new JWTError('not active', { date: new Date(payload.nbf * 1000) });
  }

  if (payload.exp !== undefined && !ignore.exp &&
    clock.timestamp >= payload.exp + clock.tolerance
  ) {
    throw new JWTError('expired', { expiredAt: new Date(payload.exp * 1000) });
  }

  if (verifyPayload.aud) {
    const aud = Array.isArray(verifyPayload.aud) ? verifyPayload.aud : [verifyPayload.aud];
    const target = Array.isArray(payload.aud) ? payload.aud : [payload.aud || ''];

    const match = target.some((targetAudience) =>
      aud.some(x => x instanceof RegExp ? x.test(targetAudience) : x === targetAudience)
    );

    if (!match) {
      throw new JWTError(`audience invalid. expected: ${aud.join(' or ')}`);
    }
  }

  if (verifyPayload.iss) {
    const invalid =
      payload.iss !== verifyPayload.iss || (Array.isArray(verifyPayload.iss) && !verifyPayload.iss.includes(payload.iss));

    if (invalid) {
      throw new JWTError(`issuer invalid. expected: ${verifyPayload.iss}`);
    }
  }

  if (verifyPayload.sub && payload.sub !== verifyPayload.sub) {
    throw new JWTError(`subject invalid. expected: ${verifyPayload.sub}`);
  }

  if (verifyPayload.jti && payload.jti !== verifyPayload.jti) {
    throw new JWTError(`id invalid. expected: ${verifyPayload.jti}`);
  }

  if (options.maxAgeSec) {
    if (payload.iat === undefined) {
      throw new JWTError('iat required when maxAge is specified');
    }

    const maxAgeTimestamp = options.maxAgeSec + payload.iat;

    if (clock.timestamp >= maxAgeTimestamp + clock.tolerance) {
      throw new JWTError('maxAge exceeded', { date: new Date(maxAgeTimestamp * 1000) });
    }
  }

  return payload;
}
