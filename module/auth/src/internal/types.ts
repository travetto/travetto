export class PrincipalTarget {
  id: string;
  expiresAt?: Date;
  issuedAt?: Date;
  maxAge?: number;
  issuer?: string;
  details?: unknown;
  permissions?: string[];
}
export class AuthorizerTarget { }
export class AuthenticatorTarget { }

export const AuthTokenSymbol = Symbol.for('@travetto/auth:token');
export const PrincipalSymbol = Symbol.for('@travetto/auth:principal');

export type AuthToken = { token: string, type: string };
