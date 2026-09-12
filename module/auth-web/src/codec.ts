import { errors, jwtVerify, SignJWT } from 'jose';

import { type AuthContext, AuthenticationError, type AuthToken, type Principal } from '@travetto/auth';
import { Inject, Injectable } from '@travetto/di';
import { castTo, RuntimeError, TimeUtil } from '@travetto/runtime';
import { CookieJar, type WebAsyncContext, type WebRequest, type WebResponse } from '@travetto/web';

import type { WebAuthConfig } from './config.ts';
import { CommonPrincipalCodecSymbol, type PrincipalCodec } from './types.ts';

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

  async verify(token: string): Promise<Principal> {
    try {
      const { payload } = await jwtVerify<{ core: Principal }>(
        token,
        async protectedHeader => {
          const keyIdentifier = protectedHeader.kid ?? 'default';
          const entry = this.config.keyMap[keyIdentifier];
          if (!entry) {
            throw new AuthenticationError('Invalid signing key', { category: 'permissions' });
          }
          return entry.binaryKey;
        },
        {
          algorithms: [this.config.algorithm]
        }
      );
      return payload.core;
    } catch (error) {
      if (error instanceof errors.JOSEError) {
        throw new AuthenticationError(error.message, { category: 'permissions' });
      }
      throw error;
    }
  }

  token(request: WebRequest): AuthToken | undefined {
    const value =
      this.config.mode === 'header'
        ? request.headers.getWithPrefix(this.config.header, this.config.headerPrefix)
        : this.webAsyncContext.getValue(CookieJar).get(this.config.cookie, { signed: false });
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
    const signer = new SignJWT({ core: value })
      .setIssuedAt(value.issuedAt ?? new Date())

      .setSubject(value.id)
      .setProtectedHeader({ alg: this.config.algorithm, kid: entry.id });

    if (value.sessionId) {
      signer.setJti(value.sessionId);
    }
    if (value.expiresAt) {
      signer.setExpirationTime(value.expiresAt);
    }
    if (value.issuer) {
      signer.setIssuer(value.issuer);
    }

    return await signer.sign(entry.binaryKey);
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
