import type { Jwt, Verifier, SupportedAlgorithms } from 'njwt';

import { type AuthContext, AuthenticationError, type AuthToken, type Principal } from '@travetto/auth';
import { Injectable, Inject } from '@travetto/di';
import { type WebResponse, type WebRequest, type WebAsyncContext, CookieJar } from '@travetto/web';
import { RuntimeError, castTo, TimeUtil } from '@travetto/runtime';

import { CommonPrincipalCodecSymbol, type PrincipalCodec } from './types.ts';
import type { WebAuthConfig } from './config.ts';

/**
 * JWT Principal codec
 */
@Injectable(CommonPrincipalCodecSymbol)
export class JWTPrincipalCodec implements PrincipalCodec {

  @Inject()
  config: WebAuthConfig;

  @Inject()
  authContext: AuthContext;

  @Inject()
  webAsyncContext: WebAsyncContext;

  #verifier: Verifier;
  #algorithm: SupportedAlgorithms = 'HS256';

  async postConstruct(): Promise<void> {
    // Weird issue with their ES module support
    const { default: { createVerifier } } = await import('njwt');
    this.#verifier = createVerifier()
      .setSigningAlgorithm(this.#algorithm)
      .withKeyResolver((keyId, callback) => {
        const entry = this.config.keyMap[keyId];
        return callback(entry ? null : new AuthenticationError('Invalid'), entry.key);
      });
  }

  async verify(token: string): Promise<Principal> {
    try {
      const jwt: Jwt & { body: { core: Principal } } = await new Promise((resolve, reject) =>
        this.#verifier.verify(token, (error, verified) => error ? reject(error) : resolve(castTo(verified)))
      );
      return jwt.body.core;
    } catch (error) {
      if (error instanceof Error && error.name.startsWith('Jwt')) {
        throw new AuthenticationError(error.message, { category: 'permissions' });
      }
      throw error;
    }
  }

  token(request: WebRequest): AuthToken | undefined {
    const value = (this.config.mode === 'header') ?
      request.headers.getWithPrefix(this.config.header, this.config.headerPrefix) :
      this.webAsyncContext.getValue(CookieJar).get(this.config.cookie, { signed: false });
    return value ? { type: 'jwt', value } : undefined;
  }

  async decode(request: WebRequest): Promise<Principal | undefined> {
    const token = this.token(request);
    return token ? await this.verify(token.value) : undefined;
  }

  async create(value: Principal, keyId: string = 'default'): Promise<string> {
    const entry = this.config.keyMap[keyId];
    if (!entry) {
      throw new RuntimeError('Requested unknown key for signing');
    }
    // Weird issue with their ES module support
    const { default: { create } } = await import('njwt');
    const jwt = create({}, '-')
      .setExpiration(value.expiresAt!)
      .setIssuedAt(TimeUtil.duration((value.issuedAt ?? new Date()).getTime(), 's'))
      .setClaim('core', castTo({ ...value }))
      .setIssuer(value.issuer!)
      .setJti(value.sessionId!)
      .setSubject(value.id)
      .setHeader('kid', entry.id)
      .setSigningKey(entry.key)
      .setSigningAlgorithm(this.#algorithm);
    return jwt.toString();
  }

  async encode(response: WebResponse, data: Principal | undefined): Promise<WebResponse> {
    const token = data ? await this.create(data) : undefined;
    const { header, headerPrefix, cookie } = this.config;
    if (this.config.mode === 'header') {
      response.headers.setWithPrefix(header, token, headerPrefix);
    } else {
      this.webAsyncContext.getValue(CookieJar).set({ name: cookie, value: token, signed: false, expires: data?.expiresAt });
    }
    return response;
  }
}
