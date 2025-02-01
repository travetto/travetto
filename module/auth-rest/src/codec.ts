import { createVerifier, create, Jwt, Verifier, SupportedAlgorithms } from 'njwt';

import { AuthContext, Principal } from '@travetto/auth';
import { Injectable, Inject } from '@travetto/di';
import { FilterContext, RestCommonUtil } from '@travetto/rest';
import { AppError, castTo, TimeUtil } from '@travetto/runtime';

import { CommonPrincipalCodecSymbol, PrincipalCodec } from './types';
import { RestAuthConfig } from './config';

/**
 * JWT Principal codec
 */
@Injectable(CommonPrincipalCodecSymbol)
export class JWTPrincipalCodec implements PrincipalCodec {

  @Inject()
  config: RestAuthConfig;

  @Inject()
  authContext: AuthContext;

  #verifier: Verifier;
  #algorithm: SupportedAlgorithms = 'HS256';

  postConstruct(): void {
    this.#verifier = createVerifier()
      .setSigningKey(this.config.signingKey!)
      .setSigningAlgorithm(this.#algorithm);
  }

  async verify(token: string): Promise<Principal> {
    try {
      const jwt: Jwt & { body: { core: Principal } } = await new Promise((res, rej) =>
        this.#verifier.verify(token, (err, v) => err ? rej(err) : res(castTo(v)))
      );
      return jwt.body.core;
    } catch (err) {
      if (err instanceof Error && err.name.startsWith('Jwt')) {
        throw new AppError(err.message, { category: 'permissions' });
      }
      throw err;
    }
  }

  async decode(ctx: FilterContext): Promise<Principal | undefined> {
    const token = RestCommonUtil.readValue(this.config, ctx.req, { signed: false });
    if (token) {
      const out = await this.verify(token);
      if (out) {
        this.authContext.authToken = { type: 'jwt', value: token };
      }
      return out;
    }
  }

  async create(value: Principal): Promise<string> {
    const jwt = create({}, this.config.signingKey, this.#algorithm)
      .setExpiration(value.expiresAt!)
      .setIssuedAt(TimeUtil.asSeconds(value.issuedAt!))
      .setClaim('core', castTo({ ...value }))
      .setIssuer(value.issuer!)
      .setJti(value.sessionId!)
      .setSubject(value.id);
    return jwt.toString();
  }

  async encode(ctx: FilterContext, data: Principal | undefined): Promise<void> {
    const token = data ? await this.create(data) : undefined;
    RestCommonUtil.writeValue(this.config, ctx.res, token, { expires: data?.expiresAt, signed: false });
  }
}
