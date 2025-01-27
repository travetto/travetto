import { TimeUtil } from '@travetto/runtime';
import { JWTUtil } from './util';
import { Payload, PayloadMeta } from './types';

/**
 * Token signer
 */
export class JWTSigner<T extends object> {

  signingKey: string;
  toPayload: (v: T) => PayloadMeta;
  onLoad?: (v: T) => T;

  constructor(key: string, toPayload: (v: T) => PayloadMeta, onLoad?: (v: T) => T) {
    this.signingKey = key;
    this.toPayload = toPayload;
    this.onLoad = onLoad;
  }

  /**
   * Verify token via the signing key
   */
  verify(token: string): Promise<T> {
    return JWTUtil.verify<{ core: T }>(token, { key: this.signingKey }).then(v => this.onLoad?.(v.core) ?? v.core);
  }

  /**
   * Rewrite token, transforming the core
   */
  rewrite(token: string, op: (src: T) => T): Promise<string> {
    return JWTUtil.rewrite<Payload & { core: T }>(
      token,
      p => ({ ...p, core: op(p.core) }),
      { key: this.signingKey }
    );
  }

  /**
   * Get token for principal
   */
  create(value: T): Promise<string> {
    const meta = this.toPayload(value);
    return JWTUtil.create({
      core: { ...value, },
      exp: TimeUtil.asSeconds(meta.expiresAt),
      iat: TimeUtil.asSeconds(meta.issuedAt),
      jti: meta.sessionId,
      iss: meta.issuer,
      sub: meta.id,
    }, { key: this.signingKey });
  }
}