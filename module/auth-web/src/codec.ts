import { createVerifier, create, Jwt, Verifier, SupportedAlgorithms } from 'njwt';

import { AuthContext, AuthenticationError, AuthToken, Principal } from '@travetto/auth';
import { Injectable, Inject } from '@travetto/di';
import { HttpResponse, HttpRequest } from '@travetto/web';
import { AppError, castTo, TimeUtil } from '@travetto/runtime';

import { CommonPrincipalCodecSymbol, PrincipalCodec } from './types.ts';
import { WebAuthConfig } from './config.ts';

/**
 * JWT Principal codec
 */
@Injectable(CommonPrincipalCodecSymbol)
export class JWTPrincipalCodec implements PrincipalCodec {

  @Inject()
  config: WebAuthConfig;

  @Inject()
  authContext: AuthContext;

  #verifier: Verifier;
  #algorithm: SupportedAlgorithms = 'HS256';

  postConstruct(): void {
    this.#verifier = createVerifier()
      .setSigningAlgorithm(this.#algorithm)
      .withKeyResolver((kid, cb) => {
        const rec = this.config.keyMap[kid];
        return cb(rec ? null : new AuthenticationError('Invalid'), rec.key);
      });
  }

  async verify(token: string): Promise<Principal> {
    try {
      const jwt: Jwt & { body: { core: Principal } } = await new Promise((res, rej) =>
        this.#verifier.verify(token, (err, v) => err ? rej(err) : res(castTo(v)))
      );
      return jwt.body.core;
    } catch (err) {
      if (err instanceof Error && err.name.startsWith('Jwt')) {
        throw new AuthenticationError(err.message, { category: 'permissions' });
      }
      throw err;
    }
  }

  token(req: HttpRequest): AuthToken | undefined {
    const value = req.readMetadata(this.config, { signed: false });
    return value ? { type: 'jwt', value } : undefined;
  }

  async decode(req: HttpRequest): Promise<Principal | undefined> {
    const token = this.token(req);
    return token ? await this.verify(token.value) : undefined;
  }

  async create(value: Principal, keyId: string = 'default'): Promise<string> {
    const keyRec = this.config.keyMap[keyId];
    if (!keyRec) {
      throw new AppError('Requested unknown key for signing');
    }
    const jwt = create({}, '-')
      .setExpiration(value.expiresAt!)
      .setIssuedAt(TimeUtil.asSeconds(value.issuedAt!))
      .setClaim('core', castTo({ ...value }))
      .setIssuer(value.issuer!)
      .setJti(value.sessionId!)
      .setSubject(value.id)
      .setHeader('kid', keyRec.id)
      .setSigningKey(keyRec.key)
      .setSigningAlgorithm(this.#algorithm);
    return jwt.toString();
  }

  async encode(res: HttpResponse, data: Principal | undefined): Promise<HttpResponse> {
    const token = data ? await this.create(data) : undefined;
    res.writeMetadata(this.config, token, { expires: data?.expiresAt, signed: false });
    return res;
  }
}
